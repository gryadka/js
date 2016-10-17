import {MultiRequest} from "./utils/MultiRequest";
import {log, msg} from "./utils/Logging";

const OK = typedRespondAbstractFactory("OK");
const NO = typedRespondAbstractFactory("NO");
const UNKNOWN = typedRespondAbstractFactory("UNKNOWN");

export default class Proposer {
    constructor(id, cache, acceptors, time, quorum, isLeaderless) {
        this.id = id;
        this.cache = cache;
        this.acceptors = acceptors;
        this.time = time;
        this.quorum = quorum;
        this.isLeaderless = isLeaderless;
    }

    async changeQuery(key, change, query, extra) {
        if (!this.cache.tryLock(key)) {
            return NO(log().append(msg("ERRNO002")).core);
        }
        if (this.isLeaderless || !this.cache.isLeader(key)) {
            const err1 = await this._becomeLeader(key, extra);
            if (err1) {
                this.cache.unlock(key);
                return NO(err1.append(msg("ERRNO003")).core);
            }
        }
        const [state, err2] = change(this.cache.getState(key));
        this.cache.updateState(key, state);
        const tick = this.time.tick().asJSON();
        const resp = MultiRequest.fromPromises(this.acceptors.map(x => x.accept(this.id, key, tick, state, extra)));
        const [ok, err3] = await this._await(key, resp, x => x.msg.isOk, this.quorum.write);
        this.cache.unlock(key);
        if (err3) return UNKNOWN(err3.append(msg("ERRNO004")).core);
        if (err2) return NO(err2.append(msg("ERRNO005")).core);
        return OK(query(state));
    }

    async _becomeLeader(key, extra) {
        const tick = this.time.tick().asJSON();
        const resp = MultiRequest.fromPromises(this.acceptors.map(x => x.prepare(this.id, key, tick, extra)));
        const [ok, err1] = await this._await(
            key, resp, x => x.msg.isPrepared && !x.acceptor.shouldIgnore, this.quorum.read
        );
        if (err1) return err1.append(msg("ERRNO006"));
        this.cache.becomeLeader(key, max(ok, x => x.msg.tick).msg.state);
        return false;
    }

    async _await(key, resp, filter, atLeast) {
        const [ok, err] = await (resp.filter(x => filter(x)).atLeast(atLeast));
        var hasConflicts = false; 
        for (const x of resp.abort().filter(x => x.msg.isConflict)) {
            this.time.fastforward(x.msg.tick);
            hasConflicts = true;
        }
        if (err && hasConflicts) {
            this.cache.lostLeadership(key);
            return [null, err.append(msg("ERRNO007"))];
        } else if (err) {
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