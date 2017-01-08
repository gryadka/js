import {log, msg} from "../../paxos/utils/Logging";

module.exports = function (x) {
    return function (state) {
        if (state==null) [null, log().append(msg("ERRNO010"))]
        if (state.version != x.version) {
            return [state, log().append(msg("ERRNO011"))]
        } else {
            return [{
                version: state.version+1,
                value: x.value
            }, null]
        }
    }
}