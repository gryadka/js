const {log, msg} = require("./Logging");

class InsufficientQuorumError extends Error {
    constructor(code, ...args) {
        super(...args)
        this.code = code;
        Error.captureStackTrace(this, InsufficientQuorumError)
    }
}

function waitFor(promises, cond, count) {
    return new Promise((resolve, reject) => {
        let failed = 0;
        let isResolved = false;
        const result = [];
        for (let promise of promises) {
            (async function() {
                let value = null;
                let error = false;
                try {
                    value = await promise;
                    if (isResolved) return;
                    if (!cond(value)) {
                        error = true;
                    }
                } catch (e) {
                    if (isResolved) return;
                    error = true;
                }
                if (error) {
                    failed++;
                    if (count > promises.length - failed) {
                        isResolved = true;
                        reject(new InsufficientQuorumError());
                    }
                } else {
                    result.push(value);
                    if (result.length == count) {
                        isResolved = true;
                        resolve(result);
                    }
                }
            })()
        }
    });
}

exports.waitFor = waitFor;
exports.InsufficientQuorumError = InsufficientQuorumError;