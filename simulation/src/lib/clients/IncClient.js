const {ProposerError} = require("gryadka-core");

class CompositeError extends Error {
    constructor(errors) {
        super()
        this.errors = errors;
        Error.captureStackTrace(this, CompositeError)
    }
}

class FinishedCoroutineError extends Error {
    constructor() {
        super()
        Error.captureStackTrace(this, CompositeError)
    }
}

function setIf(version, value) {
    return function (state) {
        if (state==null) {
            return {
                version: version, 
                value: value
            };
        }
        if (state.version != version) {
            throw new Error("state.version != version");
        } else {
            return {
                version: state.version+1,
                value: value
            };
        }
    }
}

function readOrInit(state) {
    if (state==null) {
        return {
            version: 0,
            value: 0
        }
    } else {
        return state
    }
}

class IncClient {
    static spawn({ctx, id, proposers, keys, consistencyChecker}) {
        const c1 = new IncClient(ctx, consistencyChecker, id, keys);
        c1.proposers = [...proposers];
        c1.start();
        return c1;
    }
    constructor(ctx, consistencyChecker, id, keys) {
        this.ctx = ctx;
        this.consistencyChecker = consistencyChecker;
        this.id = id;
        this.keys = keys;
        this.proposers = [];
        
        this.errors = [];
        this.isActive = true;
        this.hasFinished = false;
        this.stopHandlers = new Set();

        this.conditions = new Set();
        this.stat = {
            tries: 0,
            writes: 0
        };
    }
    
    async start() {
        try {
            while (this.isActive) {
                await (async () => {
                    while (true) {
                        const proposer = this.ctx.random.anyOf(this.proposers);
                        const key = this.ctx.random.anyOf(this.keys);
                        for (let i=0;i<2;i++) {
                            await this.ctx.timer.yield();
                            try {
                                this.onIterationStarted();
                                this.stat.tries++;
                                
                                let tx = this.consistencyChecker.tx(key);
                                const read = await proposer.change(key, readOrInit, this.id+":r");
                                tx.seen(read);

                                tx = this.consistencyChecker.tx(key);
                                const write = await proposer.change(key, setIf(
                                    read.version,
                                    read.value + 3
                                ), this.id + ":w");
                                tx.seen(write);
                                
                                this.stat.writes++;

                                return;
                            } catch(e) {
                                if (e instanceof ProposerError) {
                                    if (e.code == "ConcurrentRequestError") {
                                        continue;
                                    }
                                    if (e.code == "PrepareError") {
                                        continue;
                                    }
                                    if (e.code == "CommitError") {
                                        continue;
                                    }
                                    if (e.code == "UpdateError") {
                                        continue;
                                    }
                                }
                                throw e;
                            }
                        }
                    }
                })();
            }
        } catch (e) {
            this.errors.push(e);
        }

        this.isActive = false;
        this.hasFinished = true;

        if (this.errors.length > 0) {
            const error = new CompositeError(this.errors);
            for (let condition of this.conditions) {
                condition.reject(error);
            }
            this.conditions = new Set();
            for (let stopHandler of this.stopHandlers) {
                stopHandler.reject(error);
            }
        } else {
            for (let condition of this.conditions) {
                condition.reject(new FinishedCoroutineError());
            }
            this.conditions = new Set();
            for (let stopHandler of this.stopHandlers) {
                stopHandler.resolve(true);
            }
            this.stopHandlers = new Set();
        }
    }

    stop() {
        return new Promise((resolve,reject) => {
            if (this.hasFinished) {
                reject(new FinishedCoroutineError());
            } else {
                this.isActive = false;
                this.stopHandlers.add({
                    resolve: resolve,
                    reject: reject
                });
            }
        });
    }

    raise(e) {
        this.isActive = false;
        this.errors.push(e);
    }
    
    wait(condition) {
        return new Promise((resolve, reject) => {
            if (this.hasFinished) {
                reject(new FinishedCoroutineError());
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
exports.CompositeError = CompositeError;
exports.FinishedCoroutineError = FinishedCoroutineError;