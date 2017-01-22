function msg(id) {
    return {"id": id};
}

function log() {
    return new Log([]);
}

class Log {
    constructor(core) {
        this.core = core;
    }
    append(item) {
        return new Log(this.core.concat(item));
    }
}

exports.msg = msg;
exports.log = log;