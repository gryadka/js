import {MultiPromise} from "./utils/MultiRequest";
import {log, msg} from "./utils/Logging";

const OK = typedRespondAbstractFactory("OK");
const NO = typedRespondAbstractFactory("NO");
const UNKNOWN = typedRespondAbstractFactory("UNKNOWN");

export default class Proposer {
    constructor(cache, acceptors, quorum, isLeaderless) {
        this.cache = cache;
        this.acceptors = acceptors;
        this.quorum = quorum;
        this.isLeaderless = isLeaderless;
    }

    async changeQuery(key, change, query, extra) {
        if (!this.cache.tryLock(key)) {
            return NO(log().append(msg("ERRNO002")).core);
        }
        let tick = null;
        if (this.isLeaderless || !this.cache.isLeader(key)) {
            tick = this.cache.tick(key).asJSON();
            const resp = MultiPromise.fromPromises(this.acceptors.map(x => x.prepare(key, tick, extra)));
            const [ok, err1] = await this._await(
                key, resp, x => x.msg.isPrepared && !x.acceptor.shouldIgnore, this.quorum.read
            );
            if (err1) {
                this.cache.unlock(key);
                return NO(err1.append(msg("ERRNO006")).append(msg("ERRNO003")).core);
            }
            this.cache.becomeLeader(key, max(ok, x => x.msg.tick).msg.state);
        } else {
            tick = this.cache.tick(key).asJSON();
        }
        const [state, err2] = change(this.cache.getState(key));
        const resp = MultiPromise.fromPromises(this.acceptors.map(x => x.accept(key, tick, state, extra)));
        const [ok, err3] = await this._await(key, resp, x => x.msg.isOk, this.quorum.write);
        this.cache.unlock(key);
        if (err3) {
            return UNKNOWN(err3.append(msg("ERRNO004")).core);
        }
        this.cache.updateState(key, state);
        if (err2) return NO(err2.append(msg("ERRNO005")).core);
        return OK(query(state));
    }

    async _await(key, resp, filter, atLeast) {
        const [ok, err] = await (resp.filter(x => filter(x)).atLeast(atLeast));
        var hasConflicts = false; 
        for (const x of resp.abort().filter(x => x.msg.isConflict)) {
            this.cache.fastforward(key, x.msg.tick);
            hasConflicts = true;
        }
        if (hasConflicts) {
            this.cache.lostLeadership(key);
        }
        if (err && hasConflicts) {
            this.cache.lostLeadership(key);
            return [null, err.append(msg("ERRNO007"))];
        } else if (err) {
            this.cache.lostLeadership(key);
            return [null, err.append(msg("ERRNO008"))];
        }
        return [ok, null];
    }
}

function max(iterable, selector) {
    return iterable.reduce((acc,e) => {
        return selector(acc).compareTo(selector(e)) < 0 ? e : acc
    }, iterable[0]);
}

function typedRespondAbstractFactory(respondType) {
    return details => ({ "status": respondType, "details": details }); 
}