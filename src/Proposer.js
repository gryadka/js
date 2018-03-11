class ProposerError extends Error {
    static ConcurrentRequestError() {
        return new ProposerError("ConcurrentRequestError");
    }

    static PrepareError(err) {
        return new ProposerError("PrepareError")
    }

    static CommitError(candidate) {
        const error = new ProposerError("CommitError")
        error.candidate = candidate;
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

class InsufficientQuorumError extends Error {
    constructor(all, ...args) {
        super(...args)
        this.all = all;
        Error.captureStackTrace(this, InsufficientQuorumError)
    }
}

class Proposer {
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
            let ok = null;
            try {
                [ok] = await waitFor(
                    this.prepare.nodes.map(x => x.prepare(key, tick, extra)),
                    x => x.msg.isPrepared,
                    this.prepare.quorum
                );
            } catch (e) {
                if (e instanceof InsufficientQuorumError) {
                    for (const x of e.all.filter(x => x.msg.isConflict)) {
                        this.cache.fastforward(key, x.msg.tick);
                    }
                    throw ProposerError.PrepareError();
                } else {
                    throw e;
                }
            }
            const value = max(ok, x => x.msg.tick).msg.value;
            this.cache.becomeLeader(key, value);
            return [tick, value];
        } else {
            return [tick, this.cache.getValue(key)];
        }
    }

    async commitValue(key, tick, curr, next, extra) {
        let ok = null;
        let all = [];
        
        try {
            [ok, all] = await waitFor(
                this.accept.nodes.map(x => x.accept(key, tick, next, extra)),
                x => x.msg.isOk,
                this.accept.quorum
            );
        } catch (e) {
            if (e instanceof InsufficientQuorumError) {
                all = e.all;
                throw ProposerError.CommitError(curr);
            } else {
                throw e;
            }
        } finally {
            for (const x of all.filter(x => x.msg.isConflict)) {
                this.cache.fastforward(key, x.msg.tick);
                this.cache.lostLeadership(key);
            }
        }
    }
}

function max(iterable, selector) {
    return iterable.reduce((acc,e) => {
        return selector(acc).compareTo(selector(e)) < 0 ? e : acc
    }, iterable[0]);
}

function waitFor(promises, cond, count) {
    return new Promise((resolve, reject) => {
        const result = [];
        const all = [];
        let isResolved = false;
        let failed = 0;
        for (let promise of promises) {
            (async function() {
                let value = null;
                let error = false;
                try {
                    value = await promise;
                    if (isResolved) return;
                    all.push(value);
                    if (!cond(value)) error = true;
                } catch(e) {
                    if (isResolved) return;
                    error = true;
                }
                if (error) {
                    failed += 1;
                    if (promises.length - failed < count) {
                        isResolved = true;
                        reject(new InsufficientQuorumError(all));
                    }
                } else {
                    result.push(value);
                    if (result.length == count) {
                        isResolved = true;
                        resolve([result, all]);
                    }
                }
            })()
        }
    });
}

exports.Proposer = Proposer;
exports.ProposerError = ProposerError;