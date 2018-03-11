const {log, msg} = require("./Logging");

function updateChange(x) {
    return function (state) {
        if (state==null) {
            return [{
                version: x.version, 
                value: x.value
            }, null];
        }
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

function isUpdateChangeNoError(e) {
    if (!e) return false;
    if (e.status!="NO") return false;
    if (!e.details) return false;
    if (e.details.length!=2) return false;
    for (const id of ["ERRNO014","ERRNO005"]) {
        if (!e.details.some(x => x.id==id)) return false;
    }
    return true;
}

function initChange(x) {
    return function (state) {
        if (state==null) {
            return [{
                version: 0,
                value: x
            }, null]
        } else {
            return [state, null]
        }
    }
}

exports.updateChange = updateChange;
exports.isUpdateChangeNoError = isUpdateChangeNoError;
exports.initChange = initChange;