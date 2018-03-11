const {RetryCountExceedError} = require("./exceptions");
const {ProposerError} = require("../../../../src/Proposer");

/////////

function msg(id) {
    return {"id": id};
}

function log() {
    return new Log([]);
}

class Log {
    constructor(core) {
        this.core = core;
    }
    append(item) {
        return new Log(this.core.concat(item));
    }
}

function updateChange(x) {
    return function (state) {
        if (state==null) {
            return [{
                version: x.version, 
                value: x.value
            }, null];
        }
        if (state.version != x.version) {
            return [state, log().append(msg("ERRNO014"))]
        } else {
            return [{
                version: state.version+1,
                value: x.value
            }, null]
        }
    }
}

function initChange(x) {
    return function (state) {
        if (state==null) {
            return [{
                version: 0,
                value: x
            }, null]
        } else {
            return [state, null]
        }
    }
}

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
        }, extra)).details;
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

/////////

function getErrorChecker(status, errors) {
    return function(e) {
        if (!e) return false;
        if (e.status!=status) return false;
        if (!e.details) return false;
        if (e.details.length!=errors.length) return false;
        for (const id of errors) {
            if (!e.details.some(x => x.id==id)) return false;
        }
        return true;
    };
}

const isAcceptUnknownError = getErrorChecker("UNKNOWN", ["ERRNO004","ERRNO009"]);
const isProposeNoError = getErrorChecker("NO", ["ERRNO003","ERRNO009"]);
const isConcurrentNoError = getErrorChecker("NO", ["ERRNO002"]);

function isUpdateChangeNoError(e) {
    if (!e) return false;
    if (e.status!="NO") return false;
    if (!e.details) return false;
    if (e.details.length!=2) return false;
    for (const id of ["ERRNO014","ERRNO005"]) {
        if (!e.details.some(x => x.id==id)) return false;
    }
    return true;
}

function isRetryCountExceedError(e) {
    if (!e) return false;
    return (e instanceof RetryCountExceedError)
}

const recoverableErrors = [ 
    isConcurrentNoError, isAcceptUnknownError, isProposeNoError, isUpdateChangeNoError 
]

class ReadAllKeysClient {
    static spawn({ctx, id, proposers, keys, consistencyChecker}) {
        const c1 = new ReadAllKeysClient(ctx, consistencyChecker, id, keys);
        c1.proposers = [...proposers];
        c1.thread = c1.start();
        return c1;
    }
    constructor(ctx, consistencyChecker, id, keys) {
        this.ctx = ctx;
        this.consistencyChecker = consistencyChecker;
        this.id = id;
        this.keys = keys;
        this.proposers = [];
        this.error = null;
        this.stat = {
            tries: 0,
            writes: 0
        };
        this.thread = null;
    }
    async start() {
        try {
            for (const key of this.keys) {
                await loopOnError(this.ctx.timer, async () => {
                    const proposer = this.ctx.random.anyOf(this.proposers);

                    await (async function(timer, action, errors, times) {
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
                    })(this.ctx.timer, async () => {
                        this.stat.tries++;
                        
                        let tx = this.consistencyChecker.tx(key);
                        const read = await change(proposer, key, initChange(0), this.id+":r");
                        tx.seen(read);
                        
                        this.stat.writes++;
                    }, recoverableErrors, 2);

                }, [...recoverableErrors, isRetryCountExceedError]);
            }
        } catch (e) {
            this.error = e;
            throw e;
        }
        if (this.error) {
            throw this.error;
        }
    }
}

exports.ReadAllKeysClient = ReadAllKeysClient;