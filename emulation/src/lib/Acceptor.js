const {BallotNumber} = require("gryadka");

class AcceptorClientMock {
    constructor(aid, pid, service) {
        this.aid = aid;
        this.pid = pid;
        this.service = service;
    }
    
    async prepare(key, ballot, extra) {
        return await AcceptorMock.sendPrepare(this.aid, this.pid, this.service, key, ballot, extra);
    }

    async accept(key, ballot, state, promise, extra) {
        return await AcceptorMock.sendAccept(this.aid, this.pid, this.service, key, ballot, state, promise, extra);
    }
}

class AcceptorMock {
    constructor(ctx, id) {
        this.ctx = ctx;
        this.aid = id;
        this.storage = new Map();
    }

    static async sendPrepare(aid, pid, service, key, ballot, extra) {
        const outgoing = {
            id: service.ctx.uuid(),
            aid: aid,
            pid: pid,
            cmd: "prepare",
            key: key, 
            ballot: ballot,
            extra: extra
        };
        return (await service.handler(outgoing)).response;
    }

    static async sendAccept(aid, pid, service, key, ballot, state, promise, extra) {
        const outgoing = {
            id: service.ctx.uuid(),
            aid: aid,
            pid: pid,
            cmd: "accept",
            key: key, 
            ballot: ballot,
            state: state,
            promise: promise,
            extra: extra
        };
        return (await service.handler(outgoing)).response;
    }

    createClient(pid, serviceWrapper) {
        return new AcceptorClientMock(this.aid, pid, serviceWrapper(this));
    }

    handler(request) {
        let response = null;
        if (request.cmd == "prepare") {
            response = this.prepare(request.key, request.ballot);
        } else if (request.cmd == "accept") {
            response = this.accept(request.key, request.ballot, request.state, request.promise);
        } else {
            throw new Error();
        }
        return Promise.resolve({
            id: request.id,
            response: response 
        });
    }
    
    prepare(key, ballot) {
        if (!this.storage.has(key)) {
            this.storage.set(key, {
                promise: BallotNumber.zero(),
                ballot: BallotNumber.zero(),
                value: null
            });
        }

        var info = this.storage.get(key);

        if (info.promise.compareTo(ballot) >= 0) {
            return { isConflict: true, ballot: info.promise };
        }

        if (info.ballot.compareTo(ballot) >= 0) {
            return { isConflict: true, ballot: info.ballot };
        }
        
        info.promise = ballot;
        return { isPrepared: true, ballot: info.ballot, value: info.value };
    }

    accept(key, ballot, state, promise) {
         if (!this.storage.has(key)) {
            this.storage.set(key, {
                promise: BallotNumber.zero(),
                ballot: BallotNumber.zero(),
                value: null
            });
        }

        var info = this.storage.get(key);

        if (info.promise.compareTo(ballot) > 0) {
            return { isConflict: true, ballot: info.promise };
        }

        if (info.ballot.compareTo(ballot) >= 0) {
            return { isConflict: true, ballot: info.ballot };
        }
        
        info.promise = promise;
        info.ballot = ballot;
        info.value = state;
        
        return { isOk: true };
    }
}

exports.AcceptorClientMock = AcceptorClientMock;
exports.AcceptorMock = AcceptorMock;