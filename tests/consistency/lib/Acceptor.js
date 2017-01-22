const {Tick} = require("../../../src/Tick");

class AcceptorClientMock {
    constructor(aid, pid, service, isTransient) {
        this.aid = aid;
        this.pid = pid;
        this.service = service;
        this.isTransient = isTransient;
    }
    
    async prepare(key, tick, extra) {
        const response = await AcceptorMock.sendPrepare(this.aid, this.pid, this.service, key, tick, extra);
        return {
            acceptor: this,
            msg: response.response
        };
    }

    async accept(key, tick, state, extra) {
        const response = await AcceptorMock.sendAccept(this.aid, this.pid, this.service, key, tick, state, extra);
        return {
            acceptor: this,
            msg: response.response
        };
    }
}

class AcceptorMock {
    constructor(ctx, id) {
        this.ctx = ctx;
        this.aid = id;
        this.storage = new Map();
    }

    static sendPrepare(aid, pid, service, key, tick, extra) {
        const outgoing = {
            id: service.ctx.uuid(),
            aid: aid,
            pid: pid,
            cmd: "prepare",
            key: key, 
            tick: tick,
            extra: extra
        };
        return service.handler(outgoing);
    }

    static sendAccept(aid, pid, service, key, tick, state, extra) {
        const outgoing = {
            id: service.ctx.uuid(),
            aid: aid,
            pid: pid,
            cmd: "accept",
            key: key, 
            tick: tick,
            state: state,
            extra: extra
        };
        return service.handler(outgoing);
    }

    createClient(pid, serviceWrapper, isTransient) {
        return new AcceptorClientMock(this.aid, pid, serviceWrapper(this), isTransient);
    }

    handler(request) {
        let response = null;
        if (request.cmd == "prepare") {
            response = this.prepare(request.key, request.tick);
        } else if (request.cmd == "accept") {
            response = this.accept(request.key, request.tick, request.state);
        } else {
            throw new Error();
        }
        return Promise.resolve({
            id: request.id,
            response: response 
        });
    }
    
    prepare(key, tick) {
        if (!this.storage.has(key)) {
            this.storage.set(key, {
                promise: Tick.zero(),
                ballot: Tick.zero(),
                value: null
            });
        }

        var info = this.storage.get(key);
        
        if (info.promise.compareTo(tick) < 0) {
            info.promise = tick;
            return { isPrepared: true, tick: info.ballot, value: info.value };
        } else {
            return { isConflict: true, tick: info.promise };
        }
    }

    accept(key, tick, state) {
         if (!this.storage.has(key)) {
            this.storage.set(key, {
                promise: Tick.zero(),
                ballot: Tick.zero(),
                value: null
            });
        }

        var info = this.storage.get(key);
        
        if (info.promise.compareTo(tick) <= 0) {
            info.promise = tick;
            info.ballot = tick;
            info.value = state;
            
            return { isOk: true };
        } else {
            return { isConflict: true, tick: info.promise };
        }
    }
}

exports.AcceptorClientMock = AcceptorClientMock;
exports.AcceptorMock = AcceptorMock;