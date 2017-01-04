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

export function isAcceptUnknownError(e) {
    if (!e) return false;
    if (e.status!="UNKNOWN") return false;
    if (!e.details) return false;
    if (e.details.length!=2) return false;
    for (const id of ["ERRNO004","ERRNO009"]) {
        if (!e.details.some(x => x.id==id)) return false;
    }
    return true;
}

export function isProposeNoError(e) {
    if (!e) return false;
    if (e.status!="NO") return false;
    if (!e.details) return false;
    if (e.details.length!=2) return false;
    for (const id of ["ERRNO003","ERRNO009"]) {
        if (!e.details.some(x => x.id==id)) return false;
    }
    return true;
}

export function isLeadershipNoError(e) {
    if (!e) return false;
    if (e.status!="NO") return false;
    if (!e.details) return false;
    if (e.details.length!=2) return false;
    for (const id of ["ERRNO009","ERRNO003"]) {
        if (!e.details.some(x => x.id==id)) return false;
    }
    return true;
}

export function isLeadershipUnknownError(e) {
    if (!e) return false;
    if (e.status!="UNKNOWN") return false;
    if (!e.details) return false;
    if (e.details.length!=2) return false;
    for (const id of ["ERRNO009","ERRNO004"]) {
        if (!e.details.some(x => x.id==id)) return false;
    }
    return true;
}

export function isConcurrentNoError(e) {
    if (!e) return false;
    if (e.status!="NO") return false;
    if (!e.details) return false;
    if (e.details.length!=1) return false;
    for (const id of ["ERRNO002"]) {
        if (!e.details.some(x => x.id==id)) return false;
    }
    return true;
}