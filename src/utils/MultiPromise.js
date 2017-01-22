const {log, msg} = require("./Logging");

class MultiPromise {
    static fromPromises(promises) {
        const mp = new MultiPromise(promises.length);
        for (let promise of promises) {
            (async function() {
                try {
                    mp.emit({ isValid: true, msg: await promise })
                } catch(e) {
                    mp.emit({ isValid: false, msg: null });
                }
            })()
        }
        return mp;
    }
    constructor(expected) {
        this.expected = expected;
        this.resolved = [];
        this.dependents = [];
    }
    emit({ isValid, msg }) {
        this.resolved.push({ isValid, msg });
        for (let dependent of this.dependents) {
            dependent({ isValid, msg });
        }
    }
    filter(predicate) {
        const mp = new MultiPromise(this.expected);
        const onEvent = ({ isValid, msg }) => { 
            if (isValid && predicate(msg)) {
                mp.emit({ isValid, msg });
            } else {
                mp.emit({ isValid: false, msg: null });
            }  
        };
        this.dependents.push(onEvent);
        for (let event of this.resolved) {
            onEvent(event);
        }
        return mp;
    }
    atLeast(count) {
        return new Promise((resolve, _) => {
            const data = [];
            let failed = 0;
            let isResolved = false;
            const onEvent = event => { 
                if (isResolved) return;
                if (event.isValid) {
                    data.push(event.msg);
                } else {
                    failed += 1;
                }
                if (count > this.expected - failed) {
                    isResolved = true;
                    resolve([null, log().append(msg("ERRNO009"))]);
                } else if (data.length == count) {
                    isResolved = true;
                    resolve([data, null]);
                }
            };
            this.dependents.push(onEvent);
            for (let event of this.resolved) {
                onEvent(event);
            }
        });
    }
    abort() {
        return this.resolved.filter(x => x.isValid).map(x => x.msg);
    }
}

exports.MultiPromise = MultiPromise;