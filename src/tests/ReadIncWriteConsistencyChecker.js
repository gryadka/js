export default class ReadIncWriteConsistencyChecker {
    constructor() {
        this.assert = x => {
            if (!x) throw new Error("Consistency violation");
        };
        this.state = new Map();
        this.attempts = new Map();
    }
    inited(key, version, value) {
        this.assert(!this.attempts.has(key));
        this.assert(!this.state.has(key));
        this.attempts.set(key, new Map([[version, value]]));
        this.state.set(key, { version, value} );
    }
    seen(key, version, value) {
        this.assert(this.attempts.get(key).get(version)==value);
        this.assert(this.state.get(key).version <= version);
        this.state.set(key, { version, value });
    }
    writing(key, version, value) {
        this.attempts.get(key).set(version+1, value);
    }
    written(key, version, value) {
        this.state.set(key, { version: version+1, value: value });
    }
}