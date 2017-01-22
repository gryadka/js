const {MultiPromise} = require("./utils/MultiPromise");
const {log, msg} = require("./utils/Logging");

const typedRespondAbstractFactory = respondType => details => ({ "status": respondType, "details": details });

const OK = typedRespondAbstractFactory("OK");
const NO = typedRespondAbstractFactory("NO");
const UNKNOWN = typedRespondAbstractFactory("UNKNOWN");

class Proposer {
    constructor(cache, acceptors, quorum) {
        this.cache = cache;
        this.acceptors = acceptors;
        this.quorum = quorum;
    }

    async changeQuery(key, change, query, extra) {
        if (!this.cache.tryLock(key)) {
            return NO(log().append(msg("ERRNO002")).core);
        }
        try {
            const [[tick, curr], err1] = await this.guessValue(key, extra);
            if (err1) {
                return NO(err1.core);
            }
            
            const [next, err2] = change(curr);

            const [ok, err3] = await this.commitValue(key, tick, next, extra);
            if (err3) {
                return UNKNOWN(err3.append(msg("ERRNO004")).core);
            }
            
            this.cache.updateValue(key, next);
            if (err2) {
                return NO(err2.append(msg("ERRNO005")).core);
            }
            
            return OK(query(next));
        } finally {
            this.cache.unlock(key);
        }
    }

    async guessValue(key, extra) {
        const tick = this.cache.tick(key);
        if (!this.cache.isLeader(key)) {
            const resp = MultiPromise.fromPromises(this.acceptors.map(x => x.prepare(key, tick, extra)));
            const [ok, err] = await (resp.filter(x => x.msg.isPrepared).atLeast(this.quorum.read));
            if (err) {
                for (const x of resp.abort().filter(x => x.msg.isConflict)) {
                    this.cache.fastforward(key, x.msg.tick);
                }
                return [[null, null], err.append(msg("ERRNO003"))];
            }
            const value = max(ok.filter(x => !x.acceptor.isTransient), x => x.msg.tick).msg.value;
            this.cache.becomeLeader(key, value);
            return [[tick, value], null];
        } else {
            return [[tick, this.cache.getValue(key)], null];
        }
    }

    async commitValue(key, tick, next, extra) {
        const resp = MultiPromise.fromPromises(this.acceptors.map(x => x.accept(key, tick, next, extra)));
        const [ok, err3] = await (resp.filter(x => x.msg.isOk).atLeast(this.quorum.write));
        for (const x of resp.abort().filter(x => x.msg.isConflict)) {
            this.cache.fastforward(key, x.msg.tick);
            this.cache.lostLeadership(key);
        }
        return [ok, err3];
    }
}

function max(iterable, selector) {
    return iterable.reduce((acc,e) => {
        return selector(acc).compareTo(selector(e)) < 0 ? e : acc
    }, iterable[0]);
}

exports.Proposer = Proposer;