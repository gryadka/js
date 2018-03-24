class ConsistencyViolation extends Error {
    constructor(key, seenVersion, currentVersion) {
        super()
        this.key = key;
        this.seenVersion = seenVersion;
        this.currentVersion = currentVersion;
        Error.captureStackTrace(this, ConsistencyViolation)
    }
}

class IncConsistencyChecker {
    constructor() {
        this.values = new Map();
        this.handler = null;
    }
    onConsistencyViolation(handler) {
        if (this.handler != null) {
            throw new Error("this.handler != null")
        }
        this.handler = handler;
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
        if (version < this.record.version && this.cc.handler != null) {
            this.cc.handler(new ConsistencyViolation(this.key, version, this.record.version));
            return;
        };
        if (this.cc.values.has(this.key)) {
            const record = this.cc.values.get(this.key);
            if (record.version >= version) return;
        }
        this.cc.values.set(this.key, {version, value});
    }
}

exports.ConsistencyViolation = ConsistencyViolation;
exports.IncConsistencyChecker = IncConsistencyChecker;