import {Tick} from "../../../src/mvpaxos/Time";

// shame: kill me
function clone(obj) {
    return obj == null ? null : JSON.parse(JSON.stringify(obj));
}

export class AcceptorClientMock {
    // TODO: rename shouldIgnore to isBeingIntroduce
    constructor(aid, pid, service, shouldIgnore) {
        this.aid = aid;
        this.pid = pid;
        this.service = service;
        this.shouldIgnore = shouldIgnore;
    }
    
    async prepare(key, tick, extra) {
        const response = await AcceptorMock.sendPrepare(this.aid, this.pid, this.service, key, tick, extra);
        return {
            acceptor: this,
            msg: this.detick(response.response)
        };
    }

    async accept(key, tick, state, extra) {
        const response = await AcceptorMock.sendAccept(this.aid, this.pid, this.service, key, tick, state, extra);
        return {
            acceptor: this,
            msg: this.detick(response.response)
        };
    }

    detick(response) {
        let copy = Object.assign({}, response);
        if (copy.tick) {
            copy.tick = Tick.fromJSON(copy.tick);
        }
        return copy;
    }
}

export class AcceptorMock {
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

    createClient(pid, serviceWrapper, isBeingIntroduce) {
        return new AcceptorClientMock(this.aid, pid, serviceWrapper(this), isBeingIntroduce);
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
        tick = Tick.fromJSON(tick);

        if (!this.storage.has(key)) {
            this.storage.set(key, {
                promise: new Tick(0,0,0),
                ballot: new Tick(0,0,0),
                value: null
            });
        }

        var info = this.storage.get(key);
        
        if (info.promise.compareTo(tick) < 0) {
            info.promise = tick;
            return { isPrepared: true, tick: info.ballot.asJSON(), value: clone(info.value) };
        } else {
            return { isConflict: true, tick: info.promise.asJSON() };
        }
    }

    accept(key, tick, state) {
         tick = Tick.fromJSON(tick);

         if (!this.storage.has(key)) {
            this.storage.set(key, {
                promise: new Tick(0,0,0),
                ballot: new Tick(0,0,0),
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
            return { isConflict: true, tick: info.promise.asJSON() };
        }
    }
}