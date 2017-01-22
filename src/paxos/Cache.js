const {Tick} = require("./Tick");

// FIXME: Introduce TTL to avoid infinite grow of used memory
class Cache {
    constructor(id) {
        this.data = new Map();
        this.locks = new Set();
        this.id = id;
    }
    
    tick(key) {
        const slice = this._getSlice(key);
        slice.tick = slice.tick.tick();
        return slice.tick;
    }

    fastforward(key, tick) {
        const slice = this._getSlice(key);
        slice.tick = slice.tick.fastforward(tick);
    }

    _getSlice(key) {
        if (!this.data.has(key)) {
            this.data.set(key, {
                tick: new Tick(0, this.id, 0),
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
    getValue(key) {
        const slice = this._getSlice(key);
        if (!slice.isLeader) {
            throw new Error("Arrrr");
        };
        return slice.state;
    }
    updateValue(key, state) {
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

exports.Cache = Cache;