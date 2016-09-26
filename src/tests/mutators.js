import {log, msg} from "../mvpaxos/utils/Logging";

export function updateChange(x) {
    return function (state) {
        if (state==null) [null, log().append(msg("ERRNO013"))]
        if (state.version != x.version) {
            return [state, log().append(msg("ERRNO014"))]
        } else {
            return [{
                version: state.version+1,
                value: x.value
            }, null]
        }
    }
}

export function idChange (state) {
    return [state, null];
}

export function initChange(x) {
    return function (state) {
        if (state==null) {
            return [{
                version: 0,
                value: x
            }, null]
        } else {
            return [{
                version: state.version+1,
                value: state.value
            }, null]
        }
    }
}

export function idQuery(state) {
    return state;
}