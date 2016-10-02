export default class ConcurrencyConsistencyChecker {
    constructor() {
        this.assert = x => {
            if (!x) throw new Error("Consistency violation");
        };
        this.state = new Map();
    }
    sync(clientId) {
        const self = this.state.get(clientId);
        for (const id of this.state.keys()) {
            if (id == clientId) continue;
            const sib = this.state.get(id);
            for (const key of sib.keys()) {
                if (!self.has(key)) {
                    self.set(key, sib.get(key));
                }
                if (self.get(key).version < sib.get(key).version) {
                    self.set(key, sib.get(key));
                }
            }
        }
    }
    inited(clientId, key, version, value) {
        if (!this.state.has(clientId)) {
            this.state.set(clientId, new Map());
        }
        this.assert(!this.state.get(clientId).has(key));
        this.state.get(clientId).set(key, { version, value} );
    }
    seen(clientId, key, version, value) {
        this.assert(this.state.get(clientId).get(key).version <= version);
        this.state.get(clientId).set(key, { version, value });
    }
    writing(clientId, key, version, value) { }
    written(clientId, key, version, value) {
        this.assert(this.state.get(clientId).get(key).version < version);
        this.state.get(clientId).set(key, { version: version, value: value });
    }
}