const {ProposerError} = require("gryadka");

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
        c1.thread = c1.start();
        return c1;
    }
    constructor(ctx, consistencyChecker, id, keys) {
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
    }
    async start() {
        try {
            this.isActive = true;
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