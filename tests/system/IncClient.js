import {loopOnError, retryOnError, isRetryCountExceedError} from "../consistency/lib/clients/exceptions";
import {changeQuery} from "../../src/webapi/ProposerAPI"
import unwrapOk from "../consistency/lib/clients/unwrapOk"

export class IncClient {
    static spawn({ctx, consistencyChecker, proposerUrls, keys, recoverableErrors}) {
        const c1 = new IncClient(ctx, consistencyChecker, [...proposerUrls], keys, recoverableErrors);
        c1.thread = c1.start();
        return c1;
    }
    constructor(ctx, consistencyChecker, proposerUrls, keys, recoverableErrors) {
        this.ctx = ctx;
        this.consistencyChecker = consistencyChecker;
        this.proposerUrls = proposerUrls;
        this.isActive = false;
        this.conditions = new Set();
        this.iterationHandlers = [];
        this.error = null;
        this.stat = {
            tries: 0,
            writes: 0
        };
        this.keys = keys;
        this.recoverableErrors = recoverableErrors;
    }
    onIteration(handler) {
        this.iterationHandlers.push(handler);
    }
    async start() {
        try {
            this.isActive = true;
            while (this.isActive) {
                await loopOnError(this.ctx.timer, async () => {
                    const proposerUrl = this.ctx.random.anyOf(this.proposerUrls);
                    const key = this.ctx.random.anyOf(this.keys);
                    await retryOnError(this.ctx.timer, async () => {
                        this.onIterationStarted();
                        this.stat.tries++;
                        
                        let tx = this.consistencyChecker.tx(key);
                        const read = unwrapOk(await changeQuery(proposerUrl, key, "kv-init", 0, "kv-read", null, 1000));
                        tx.seen(read);

                        tx = this.consistencyChecker.tx(key);
                        const write = unwrapOk(await changeQuery(
                            proposerUrl, 
                            key, 
                            "kv-update", 
                            {
                                version: read.version,
                                value: read.value + 3
                            }, 
                            "kv-read", 
                            null, 
                            1000
                        ));
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
        for (const handler of this.iterationHandlers) {
            handler(this);
        }
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