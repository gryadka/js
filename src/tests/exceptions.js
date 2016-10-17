export async function retryOnErrors(timer, action, errors, extra) {
    while (true) {
        // to put each while's iteration as a new event in the event loop  
        await new Promise((reply, reject) => {
            timer.postpone(timer.now(), () => reply(null));
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

export function isConsistencyViolation(e) {
    if (!e) return false;
    if (e.isConsistencyViolation) return true;
    return false;
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