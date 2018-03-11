const {isRetryCountExceedError, RetryCountExceedError} = require("./exceptions");
const {initChange, updateChange} = require("../mutators");

/////////

async function loopOnError(timer, action, errors) {
    while (true) {
        // to put each while's iteration as a new event in the event loop  
        await timer.yield();
        try {
            return await action();
        } catch(e) {
            if (errors.some(isError => isError(e))) {
                continue;
            }
            throw e;
        }
    }
}

async function retryOnError(timer, action, errors, times) {
    while (times > 0) {
        // to put each while's iteration as a new event in the event loop  
        await timer.yield();
        try {
            times--;
            return await action();
        } catch(e) {
            if (errors.some(isError => isError(e))) {
                continue;
            }
            throw e;
        }
    }
    throw new RetryCountExceedError();
}

const {log, msg} = require("../Logging");
const {ProposerError, Proposer} = require("../../../../src/Proposer");

const typedRespondAbstractFactory = respondType => details => ({ "status": respondType, "details": details });

const OK = typedRespondAbstractFactory("OK");
const NO = typedRespondAbstractFactory("NO");
const UNKNOWN = typedRespondAbstractFactory("UNKNOWN");

async function change(core, key, update, extra) {
    try {
        return OK(await core.change(key, x => {
            var [val, err] = update(x);
            if (err != null) {
                throw err;
            } else {
                return val;
            }
        }, extra));
    } catch (e) {
        if (e instanceof ProposerError) {
            if (e.code == "ConcurrentRequestError") {
                return NO(log().append(msg("ERRNO002")).core);
            }
            if (e.code == "PrepareError") {
                return NO(log().append(msg("ERRNO009")).append(msg("ERRNO003")).core);
            }
            if (e.code == "CommitError") {
                return UNKNOWN(log().append(msg("ERRNO009")).append(msg("ERRNO004")).core);
            }
            if (e.code == "UpdateError") {
                return NO(e.err.append(msg("ERRNO005")).core);
            }
            throw e;
        } else {
            throw e;
        }
    }
}

function unwrapOk(obj) {
    if (obj.status=="OK") {
        return obj.details;
    } else {
        throw obj;
    }
}

/////////

class IncClient {
    static spawn({ctx, id, proposers, keys, consistencyChecker, recoverableErrors}) {
        const c1 = new IncClient(ctx, consistencyChecker, id, keys, recoverableErrors);
        c1.proposers = [...proposers];
        c1.thread = c1.start();
        return c1;
    }
    constructor(ctx, consistencyChecker, id, keys, recoverableErrors) {
        this.ctx = ctx;
        this.consistencyChecker = consistencyChecker;
        this.id = id;
        this.keys = keys;
        this.proposers = [];
        this.isActive = false;
        this.conditions = new Set();
        this.error = null;
        this.stat = {
            tries: 0,
            writes: 0
        };
        this.thread = null;
        this.recoverableErrors = recoverableErrors;
    }
    async start() {
        try {
            this.isActive = true;
            while (this.isActive) {
                await loopOnError(this.ctx.timer, async () => {
                    const proposer = this.ctx.random.anyOf(this.proposers);
                    const key = this.ctx.random.anyOf(this.keys);
                    await retryOnError(this.ctx.timer, async () => {
                        this.onIterationStarted();
                        this.stat.tries++;
                        
                        let tx = this.consistencyChecker.tx(key);
                        const read = unwrapOk(await change(proposer, key, initChange(0), this.id+":r"));
                        tx.seen(read);

                        tx = this.consistencyChecker.tx(key);
                        const write = unwrapOk(await change(proposer, key, updateChange({
                            version: read.version,
                            value: read.value + 3
                        }), this.id + ":w"));
                        tx.seen(write);
                        
                        this.stat.writes++;
                    }, this.recoverableErrors, 2);
                }, [...this.recoverableErrors, isRetryCountExceedError]);
            }
        } catch (e) {
            this.raise(e);
            throw e;
        }
        if (this.error) {
            throw this.error;
        }
    }
    async stop() {
        this.isActive = false;
        await this.thread;
    }
    raise(e) {
        this.isActive = false;
        this.error = e;
        for (let condition of this.conditions) {
            condition.reject(e);
        }
        this.conditions = new Set();
    }
    wait(condition) {
        return new Promise((resolve, reject) => {
            if (this.error) {
                reject(this.error);
            } else {
                this.conditions.add({
                    check: condition,
                    resolve: resolve,
                    reject: reject
                });
            }
        });
    }
    onIterationStarted() {
        let executed = new Set();
        for (let condition of this.conditions) {
            try {
                if (condition.check(this)) {
                    condition.resolve(true);
                    executed.add(condition);
                }
            } catch (e) {
                condition.reject(e);
                executed.add(condition);
            }
        }
        this.conditions = new Set([...this.conditions].filter(x => !executed.has(x)));
    }
}

exports.IncClient = IncClient; 