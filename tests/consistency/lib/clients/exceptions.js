export async function loopOnError(ctx, action, errors) {
    while (true) {
        // to put each while's iteration as a new event in the event loop  
        await new Promise((reply, reject) => {
            ctx.timer.postpone(0, () => reply(null));
        });
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

export async function retryOnError(ctx, action, errors, times) {
    while (times > 0) {
        // to put each while's iteration as a new event in the event loop  
        await new Promise((reply, reject) => {
            ctx.timer.postpone(0, () => reply(null));
        });
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
    if (e.details.length!=3) return false;
    for (const id of ["ERRNO004","ERRNO008","ERRNO009"]) {
        if (!e.details.some(x => x.id==id)) return false;
    }
    return true;
}

export function isProposeNoError(e) {
    if (!e) return false;
    if (e.status!="NO") return false;
    if (!e.details) return false;
    if (e.details.length!=4) return false;
    for (const id of ["ERRNO003","ERRNO006","ERRNO008","ERRNO009"]) {
        if (!e.details.some(x => x.id==id)) return false;
    }
    return true;
}

export function isLeadershipNoError(e) {
    if (!e) return false;
    if (e.status!="NO") return false;
    if (!e.details) return false;
    if (e.details.length!=4) return false;
    for (const id of ["ERRNO009","ERRNO007","ERRNO006","ERRNO003"]) {
        if (!e.details.some(x => x.id==id)) return false;
    }
    return true;
}

export function isLeadershipUnknownError(e) {
    if (!e) return false;
    if (e.status!="UNKNOWN") return false;
    if (!e.details) return false;
    if (e.details.length!=3) return false;
    for (const id of ["ERRNO009","ERRNO007","ERRNO004"]) {
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