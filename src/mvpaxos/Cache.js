import {Tick} from "./Time";

export default class Cache {
    constructor(id) {
        this.data = new Map();
        this.locks = new Set();
        this.id = id;
    }
    
    tick(key) {
        const slice = this._getSlice(key);
        slice.tick[2] += 1;
        return new Tick(slice.tick[0], slice.tick[1], slice.tick[2]);
    }

    fastforward(key, tick) {
        const slice = this._getSlice(key);
        slice.tick[0] = Math.max(slice.tick[0], tick.eon + 1);
    }

    _getSlice(key) {
        if (!this.data.has(key)) {
            this.data.set(key, {
                tick: [0, this.id, 0],
                state: null,
                isLeader: false
            })
        }
        return this.data.get(key);
    }


    tryLock(key) {
        if (this.locks.has(key)) {
            return false;
        }
        this.locks.add(key);
        return true;
    }
    unlock(key) {
        this.locks.delete(key);
    }
    isLeader(key) {
        return this._getSlice(key).isLeader;
    }
    getState(key) {
        const slice = this._getSlice(key);
        if (!slice.isLeader) {
            throw new Error("Arrrr");
        };
        return slice.state;
    }
    updateState(key, state) {
        const slice = this._getSlice(key);
        slice.state = state;
    }
    becomeLeader(key, state) {
        const slice = this._getSlice(key);
        slice.state = state;
        slice.isLeader = true;
    }
    lostLeadership(key) {
        const slice = this._getSlice(key);
        slice.state = null;
        slice.isLeader = false;
    }
}