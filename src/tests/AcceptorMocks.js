import {Tick} from "../mvpaxos/Time"

export class AcceptorMock {
    constructor() {
        this.storage = new Map();
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
    constructor(eon, bus) {
        this.eon = eon;
        this.bus = bus;
    }

    updateEon(eon) {
        return new Promise((resolve, reject) => {
            this.bus.send({cmd: "fastforward"}, () => {
                if (this.eon < eon) {
                    this.eon = eon;
                }
                resolve(this.eon);
            });
        });
    }

    read() {
        return this.eon;
    }
}

export class AcceptorClientMock {
    constructor(id, shouldIgnore, bus) {
        this.id = id;
        this.shouldIgnore = shouldIgnore;
        this.bus = bus;
    }

    async prepare(proposerId, key, tick) {
        const msg = await (new Promise((resolve, reject) => {
            this.bus.send({cmd: "prepare", id: this.id, proposerId: proposerId, key: key, tick: tick }, resolve);
        }));
        return { acceptor: this, msg: msg };
    }

    async accept(proposerId, key, tick, state) {
        const msg = await (new Promise((resolve, reject) => {
            this.bus.send({cmd: "accept", id: this.id, proposerId: proposerId, key: key, tick: tick, state: state }, resolve);
        }));
        return { acceptor: this, msg: msg }; 
    }
}

export class Bus {
    constructor() {
        this.events = [];
        this.onRead = null;
    }
    
    send(msg, callback) {
        this.events.push({ 
            msg: msg, 
            callback: callback 
        });
        if (this.onRead != null) {
            const onRead = this.onRead;
            this.onRead = null;
            onRead(this.events.shift());
        }
    }
    
    receive() {
        if (this.onRead != null) {
            throw "ERRNO012";
        } else {
            if (this.events.length == 0) {
                return new Promise((resolve, reject) => {
                    this.onRead = resolve;
                });
            } else {
                return Promise.resolve(this.events.shift());
            }
        }
    }
}

function clone(obj) {
    return obj == null ? null : JSON.parse(JSON.stringify(obj));
}