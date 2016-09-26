export default class Cache {
    constructor() {
        this.data = new Map();
        this.locks = new Set();
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
        if (this.data.has(key)) {
            return this.data.get(key).isLeader;
        }
        return false;
    }
    getState(key) {
        return this.data.get(key).state;
    }
    updateState(key, state) {
        this.data.get(key).state = state;
    }
    becomeLeader(key, state) {
        this.data.set(key, {
            state: state,
            isLeader: true
        });
    }
    lostLeadership(key) {
        if (this.data.has(key)) {
            this.data.get(key).isLeader = false;
        }
    }
}