const {ProposerError} = require("../../../../src/Proposer");

function initOrId(state) {
    if (state==null) {
        return {
            version: 0,
            value: x
        }
    } else {
        return state;
    }
}

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
                await (async () => {
                    while (true) {
                        const proposer = this.ctx.random.anyOf(this.proposers);
                        for (let i=0;i<2;i++) {
                            await this.ctx.timer.yield();
                            try {
                                this.stat.tries++;
                        
                                let tx = this.consistencyChecker.tx(key);
                                const read = await proposer.change(key, initOrId, this.id+":r");
                                tx.seen(read);
                                
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
                                    throw e;
                                } else {
                                    throw e;
                                }
                                throw e;
                            }
                        }
                    }
                })();
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