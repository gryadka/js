function ConsistencyViolation(info) {
    this.info = info;
    this.name = 'ConsistencyViolation';
    this.stack = (new Error()).stack;
}
ConsistencyViolation.prototype = Object.create(Error.prototype);
ConsistencyViolation.prototype.constructor = ConsistencyViolation;

class IncConsistencyChecker {
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

exports.ConsistencyViolation = ConsistencyViolation;
exports.IncConsistencyChecker = IncConsistencyChecker;