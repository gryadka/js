module.exports = function (x) {
    return function (state) {
        if (state==null) {
            return [{
                version: 0,
                value: x
            }, null]
        } else {
            return [{
                version: state.version+1,
                value: x
            }, null]
        }
    }
}