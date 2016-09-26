import {log, msg} from "./Logging";

class TransparentPromise {
    constructor(promise) {
        this.isResolved = false;
        this.value = null;
        this.promise = promise.then(x => {
            this.value = x;
            this.isResolved = true;
            return x;
        });
    }
    then(cont) {
        return new TransparentPromise(this.promise.then(cont));
    }
}

export class MultiRequest {
    static fromPromises(promises) {
        return new MultiRequest(promises.map(x => new TransparentPromise(x.then(y => ({
            value: y,
            hasValue: true
        })))));
    }
    
    static fromCore(core) {
        return new MultiRequest(core);
    }

    constructor(core) {
        this.core = core;
    }

    // TODO: rename abort to getResolvedValues?
    abort() {
        return this.core.filter(x => x.isResolved && x.value.hasValue).map(x => x.value.value);
    }
    
    filter(predicate) {
        return MultiRequest.fromCore(this.core.map(x => x.then(y => {
            return y.hasValue && predicate(y.value) ? y : {hasValue: false};
        })));
    }

    atLeast(count) {
        var failed = 0;
        var resolved = [];
        var total = this.core.length;
        var isCalled = false;
        var result = null;
        
        var promise = new Promise(function(resolve, reject) {
            result = x => {
                if (!isCalled) {
                    isCalled = true;
                    resolve(x);
                }
            };
        });

        this.core.forEach(x => {
            x.then(y => {
                if (y.hasValue) {
                    resolved.push(y.value);
                } else {
                    failed += 1;
                }
                if (count > total - failed) {
                    result([null, log().append(msg("ERRNO009"))]);
                } else if (resolved.length == count) {
                    result([resolved, null]);
                }
            });
        });

        return promise;
    }
}