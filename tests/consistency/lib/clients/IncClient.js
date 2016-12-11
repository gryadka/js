import {loopOnError, isRetryCountExceedError, retryOnError} from "./exceptions";
import {initChange, idChange, updateChange, idQuery} from  "../mutators";

export class IncClient {
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
    addProposer(proposer) {
        this.proposers.push(proposer);
    }
    async start() {
        try {
            this.isActive = true;
            while (this.isActive) {
                await loopOnError(this.ctx, async () => {
                    const proposer = this.ctx.random.anyOf(this.proposers);
                    const key = this.ctx.random.anyOf(this.keys);
                    await retryOnError(this.ctx, async () => {
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

function ConsistencyViolation(info) {
    this.info = info;
    this.name = 'ConsistencyViolation';
    this.stack = (new Error()).stack;
}
ConsistencyViolation.prototype = Object.create(Error.prototype);
ConsistencyViolation.prototype.constructor = ConsistencyViolation;

export class IncConsistencyChecker {
    static isConsistencyViolation(e) {
        return (e instanceof ConsistencyViolation);
    }
    constructor() {
        this.values = new Map();
    }
    tx(key) {
        if (this.values.has(key)) {
            return new ValueTx(this, key, this.values.get(key));
        } else {
            return new InitTx(this, key);
        }
    }
}

class InitTx {
    constructor(consistencyChecker, key) {
        this.cc = consistencyChecker;
        this.key = key;
    }
    seen({version, value}) {
        if (this.cc.values.has(this.key)) {
            const record = this.cc.values.get(this.key);
            if (record.version >= version) return;
        }
        this.cc.values.set(this.key, {version, value});
    }
}

class ValueTx {
    constructor(consistencyChecker, key, record) {
        this.cc = consistencyChecker;
        this.key = key;
        this.record = record;
    }
    seen({version, value}) {
        if (version < this.record.version) throw new ConsistencyViolation({
            key: this.key,
            current: version,
            last: this.record.version
        });
        if (this.cc.values.has(this.key)) {
            const record = this.cc.values.get(this.key);
            if (record.version >= version) return;
        }
        this.cc.values.set(this.key, {version, value});
    }
}

function unwrapOk(obj) {
    if (obj.status=="OK") {
        return obj.details;
    } else {
        throw obj;
    }
}