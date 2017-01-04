import {loopOnError, isRetryCountExceedError, retryOnError} from "./exceptions";
import {initChange, idChange, updateChange, idQuery} from  "../mutators";
import unwrapOk from "./unwrapOk"

export class ReadAllKeysClient {
    static spawn({ctx, id, proposers, keys, consistencyChecker, recoverableErrors}) {
        const c1 = new ReadAllKeysClient(ctx, consistencyChecker, id, keys, recoverableErrors);
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
            for (const key of this.keys) {
                await loopOnError(this.ctx.timer, async () => {
                    const proposer = this.ctx.random.anyOf(this.proposers);
                    await retryOnError(this.ctx.timer, async () => {
                        this.stat.tries++;
                        
                        let tx = this.consistencyChecker.tx(key);
                        const read = unwrapOk(await proposer.changeQuery(key, initChange(0), idQuery, this.id+":r"));
                        tx.seen(read);
                        
                        this.stat.writes++;
                    }, this.recoverableErrors, 2);
                }, [...this.recoverableErrors, isRetryCountExceedError]);
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