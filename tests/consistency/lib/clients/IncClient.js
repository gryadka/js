const {loopOnError, isRetryCountExceedError, retryOnError} = require("./exceptions");
const {initChange, idChange, updateChange, idQuery} = require("../mutators");
const {unwrapOk} = require("./unwrapOk");

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
                        const read = unwrapOk(await proposer.changeQuery(key, initChange(0), idQuery, this.id+":r"));
                        tx.seen(read);

                        tx = this.consistencyChecker.tx(key);
                        const write = unwrapOk(await proposer.changeQuery(key, updateChange({
                            version: read.version,
                            value: read.value + 3
                        }), idQuery, this.id + ":w"));
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