export function msg(id) {
    return {"id": id};
}

export function log() {
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