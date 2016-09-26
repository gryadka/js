module.exports = function (x) {
    return function (state) {
        return [x, null];
    }
}