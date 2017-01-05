export async function loopOnError(timer, action, errors) {
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

export async function retryOnError(timer, action, errors, times) {
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

export function isRetryCountExceedError(e) {
    if (!e) return false;
    return (e instanceof RetryCountExceedError)
}

export function getErrorChecker(status, errors) {
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

export const isAcceptUnknownError = getErrorChecker("UNKNOWN", ["ERRNO004","ERRNO009"]);
export const isProposeNoError = getErrorChecker("NO", ["ERRNO003","ERRNO009"]);
export const isConcurrentNoError = getErrorChecker("NO", ["ERRNO002"]);