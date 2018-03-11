async function loopOnError(timer, action, errors) {
    while (true) {
        // to put each while's iteration as a new event in the event loop  
        await timer.yield();
        try {
            return await action();
        } catch(e) {
            if (errors.some(isError => isError(e))) {
                continue;
            }
            throw e;
        }
    }
}

async function retryOnError(timer, action, errors, times) {
    while (times > 0) {
        // to put each while's iteration as a new event in the event loop  
        await timer.yield();
        try {
            times--;
            return await action();
        } catch(e) {
            if (errors.some(isError => isError(e))) {
                continue;
            }
            throw e;
        }
    }
    throw new RetryCountExceedError();
}

function RetryCountExceedError() {
    this.name = 'RetryCountExceedError';
    this.stack = (new Error()).stack;
}
RetryCountExceedError.prototype = Object.create(Error.prototype);
RetryCountExceedError.prototype.constructor = RetryCountExceedError;

function isRetryCountExceedError(e) {
    if (!e) return false;
    return (e instanceof RetryCountExceedError)
}

function getErrorChecker(status, errors) {
    return function(e) {
        if (!e) return false;
        if (e.status!=status) return false;
        if (!e.details) return false;
        if (e.details.length!=errors.length) return false;
        for (const id of errors) {
            if (!e.details.some(x => x.id==id)) return false;
        }
        return true;
    };
}

exports.RetryCountExceedError = RetryCountExceedError
exports.isRetryCountExceedError = isRetryCountExceedError;

exports.loopOnError = loopOnError;
exports.retryOnError = retryOnError;
exports.isRetryCountExceedError = isRetryCountExceedError;
exports.getErrorChecker = getErrorChecker;
exports.isAcceptUnknownError = getErrorChecker("UNKNOWN", ["ERRNO004","ERRNO009"]);
exports.isProposeNoError = getErrorChecker("NO", ["ERRNO003","ERRNO009"]);
exports.isConcurrentNoError = getErrorChecker("NO", ["ERRNO002"]);
