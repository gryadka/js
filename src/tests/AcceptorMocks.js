import {Tick} from "../mvpaxos/Time";

export class AcceptorMock {
    constructor(id, world) {
        this.id = id;
        this.world = world;
        this.storage = new Map();
    }

    isAlive() {
        return true;
    }

    tick() {
        let hadProgress = false;
        for (const ingoing of this.world.inbox(this.id)) {
            hadProgress = true;
            if (ingoing.cmd == "prepare") {
                const outgoing = {
                    id: ingoing.id,
                    recipient: ingoing.sender,
                    extra: ingoing.extra,
                    response: this.prepare(ingoing.proposerId, ingoing.key, ingoing.tick)
                };
                this.world.send(outgoing);
            }
            if (ingoing.cmd == "accept") {
                const outgoing = {
                    id: ingoing.id,
                    recipient: ingoing.sender,
                    extra: ingoing.extra,
                    response: this.accept(ingoing.proposerId, ingoing.key, ingoing.tick, ingoing.state)
                };
                this.world.send(outgoing);
            }
        }
        return hadProgress;
    }
    
    prepare(proposerId, key, tick) {
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
            return { isPrepared: true, tick: info.ballot, state: clone(info.value) };
        } else {
            return { isConflict: true, tick: info.promise };
        }
    }


    accept(proposerId, key, tick, state) {
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
            
            return { isOk: true};
        } else {
            return { isConflict: true, tick: info.promise };
        }
    }
} 



export class EonDb {
    // TODO: refactor id into address
    constructor(id, world, eon) {
        this.id = id;
        this.world = world;
        this.eon = eon;
        this.resolvers = new Map();
    }

    isAlive() {
        return true;
    }

    tick() {
        let hadProgress = false;
        for (const message of this.world.inbox(this.id)) {
            hadProgress = true;
            if (this.eon < message.eon) {
                this.eon = message.eon;
                const resolve = this.resolvers.get(message.id);
                this.resolvers.delete(message.id);
                resolve(this.eon);
            }
        }
        return hadProgress;
    }

    updateEon(eon) {
        return new Promise((resolve, reject) => {
            const outgoing = {
                id: world.uuid(), 
                recipient: this.id, 
                eon: eon 
            };
            this.resolvers.set(outgoing.id, resolve);
            this.world.send(outgoing);
        });
    }

    read() {
        return this.eon;
    }
}

export class AcceptorClientMock {
    constructor(id, world, acceptor_id, shouldIgnore, timer, timeout, isAlive) {
        this.id = id;
        this.world = world;
        this.acceptor_id = acceptor_id;
        this.shouldIgnore = shouldIgnore;
        this.resolvers = new Map();
        this.timer = timer;
        this.timeout = timeout;
        this._isAlive = isAlive;
    }
    turnOff() {
        if (!this._isAlive) throw new Error("already off");
        this._isAlive = false;
        this.world.banMessagesTo(this.id);
        this.world.dropAllMessagesFor(this.id);
    }
    turnOn() {
        if (this._isAlive) throw new Error("already on");
        this._isAlive = true;
        this.world.unbanMessagesTo(this.id);
    }
    isAlive() {
        return this._isAlive;
    }

    tick() {
        let hadProgress = false;
        for (const message of this.world.inbox(this.id)) {
            hadProgress = true;
            if (this.resolvers.has(message.id)) {
                const resolve = this.resolvers.get(message.id);
                this.resolvers.delete(message.id);
                resolve(message);
            }
        }
        return hadProgress;
    }

    async prepare(proposerId, key, tick, extra) {
        const outgoing = {
            id: this.world.uuid(),
            recipient: this.acceptor_id,
            sender: this.id,
            cmd: "prepare",
            proposerId: proposerId, 
            key: key, 
            tick: tick,
            extra: extra
        };
        const ingoing = await (new Promise((resolve, reject) => {
            this.resolvers.set(outgoing.id, resolve);
            this.world.send(outgoing);
            this.timer.postpone(this.timer.now() + this.timeout, () => {
                if (this.resolvers.has(outgoing.id)) {
                    this.resolvers.delete(outgoing.id);
                    resolve({response: {isError: true}});
                }
            });
        }));
        return { acceptor: this, msg: ingoing.response };
    }

    async accept(proposerId, key, tick, state, extra) {
        const outgoing = {
            id: this.world.uuid(),
            recipient: this.acceptor_id,
            sender: this.id,
            cmd: "accept",
            proposerId: proposerId, 
            key: key, 
            tick: tick,
            state: state,
            extra: extra
        };

        const ingoing = await (new Promise((resolve, reject) => {
            this.resolvers.set(outgoing.id, resolve);
            this.world.send(outgoing);
            this.timer.postpone(this.timer.now() + this.timeout, () => {
                if (this.resolvers.has(outgoing.id)) {
                    this.resolvers.delete(outgoing.id);
                    resolve({response: {isError: true}});
                }
            });
        }));

        return { acceptor: this, msg: ingoing.response }; 
    }
}

function clone(obj) {
    return obj == null ? null : JSON.parse(JSON.stringify(obj));
}