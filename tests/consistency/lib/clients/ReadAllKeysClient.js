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

const typedRespondAbstractFactory = respondType => details => ({ "status": respondType, "details": details });

const NO = typedRespondAbstractFactory("NO");
const UNKNOWN = typedRespondAbstractFactory("UNKNOWN");

async function change(core, key, update, extra) {
    return await core.change(key, x => {
        var [val, err] = update(x);
        if (err != null) {
            throw err;
        } else {
            return val;
        }
    }, extra);
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
const isUpdateChangeNoError = getErrorChecker("NO", ["ERRNO014", "ERRNO005"]);

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
                await (async () => {
                    while (true) {
                        const proposer = this.ctx.random.anyOf(this.proposers);
                        for (let i=0;i<2;i++) {
                            await this.ctx.timer.yield();
                            try {
                                this.stat.tries++;
                        
                                let tx = this.consistencyChecker.tx(key);
                                const read = await change(proposer, key, initChange(0), this.id+":r");
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