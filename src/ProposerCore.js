const {waitFor, InsufficientQuorumError} = require("./utils/MultiPromise");
const {log, msg} = require("./utils/Logging");

class ProposerError extends Error {
    static ConcurrentRequestError() {
        return new ProposerError("ConcurrentRequestError");
    }

    static PrepareError(err) {
        const error = new ProposerError("PrepareError")
        error.err = err;
        return error;
    }

    static CommitError(candidate, err) {
        const error = new ProposerError("CommitError")
        error.candidate = candidate;
        error.err = err;
        return error;
    }

    static UpdateError(err) {
        const error = new ProposerError("UpdateError")
        error.err = err;
        return error;
    }

    constructor(code, ...args) {
        super(...args)
        this.code = code;
        Error.captureStackTrace(this, ProposerError)
    }
}

class ProposerCore {
    constructor(cache, prepare, accept) {
        this.cache = cache;
        this.prepare = prepare;
        this.accept = accept;
    }

    async change(key, update, extra) {
        if (!this.cache.tryLock(key)) {
            throw ProposerError.ConcurrentRequestError();
        }
        try {
            const [tick, curr] = await this.guessValue(key, extra);

            let next = curr;
            let error = null;
            try {
                next = update(curr);
            } catch (e) {
                error = e;
            }

            await this.commitValue(key, tick, curr, next, extra);
            
            this.cache.updateValue(key, next);
            if (error != null) {
                throw ProposerError.UpdateError(error);
            }
            
            return next;
        } finally {
            this.cache.unlock(key);
        }
    }
    
    async guessValue(key, extra) {
        const tick = this.cache.tick(key);
        if (!this.cache.isLeader(key)) {
            const resp = MultiPromise.fromPromises(this.prepare.nodes.map(x => x.prepare(key, tick, extra)));

            let ok = null;
            try {
                ok = await (resp.filter(x => x.msg.isPrepared).atLeast(this.prepare.quorum));
            } catch(e) {
                if (e instanceof InsufficientQuorumError) {
                    for (const x of resp.abort().filter(x => x.msg.isConflict)) {
                        this.cache.fastforward(key, x.msg.tick);
                    }
                    throw ProposerError.PrepareError(e);
                }
                throw e;
            }
            const value = max(ok, x => x.msg.tick).msg.value;
            this.cache.becomeLeader(key, value);
            return [tick, value];
        } else {
            return [tick, this.cache.getValue(key)];
        }
    }

    async commitValue(key, tick, curr, next, extra) {
        const resp = MultiPromise.fromPromises(this.accept.nodes.map(x => x.accept(key, tick, next, extra)));
        let ok = null;
        let error = null;
        try {
            ok = await (resp.filter(x => x.msg.isOk).atLeast(this.accept.quorum))
        } catch(e) {
            if (e instanceof InsufficientQuorumError) {
                error = e;
            }
            throw e;
        }
        for (const x of resp.abort().filter(x => x.msg.isConflict)) {
            this.cache.fastforward(key, x.msg.tick);
            this.cache.lostLeadership(key);
        }
        if (error != null) {
            throw ProposerError.CommitError(curr, error);
        }
        return ok;
    }
}

function max(iterable, selector) {
    return iterable.reduce((acc,e) => {
        return selector(acc).compareTo(selector(e)) < 0 ? e : acc
    }, iterable[0]);
}

exports.ProposerCore = ProposerCore;
exports.ProposerError = ProposerError;