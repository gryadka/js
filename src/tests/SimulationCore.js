import fs from "fs";

export class TheLoop {
    constructor() {
        this.agents = [];
        this.timer = new Timer();
        this.idgen = 42;
        this.messages = new Map();
        this.logger = null;
    }
    setLogger(logger) {
        this.logger = logger;
    }
    uuid() {
        return this.idgen++; 
    }
    deliver(message) {
        if (message.recipient) {
            if (!this.messages.has(message.recipient)) {
                this.messages.set(message.recipient, []);
            }
            this.messages.get(message.recipient).push(message);
        } else {
            throw new Error("Missing recipient");
        }
    }
    *inbox(id) {
        if (this.messages.has(id)) {
            const messages = this.messages.get(id);
            while (messages.length > 0) {
                const message = messages.shift();
                if (this.logger != null) {
                    this.logger.log(message);
                }
                yield message;
            }
        }
    }
    addAgent(agent) {
        this.agents.push(agent);
    }
    run() {
        let hadProgress = true;
        let idleLoops = 0;

        const iter = () => setTimeout(() => {
            // console.info("Loop tick");
            hadProgress = false
            for (const agent of this.agents) {
                if (agent.tick()) {
                    hadProgress = true;
                }
            }
            if (this.timer.tick() || this.timer.hasPostponed()) {
                hadProgress = true;
            }
            if (!hadProgress) {
                idleLoops += 1;
            }
            if (idleLoops < 3) {
                hadProgress = true;
            }
            if (hadProgress) {
                iter();
            } else {
                if (this.logger != null) {
                    this.logger.flush();
                }
                // console.info("Loop stop");
            }
        }, 0);

        // console.info("Loop start");
        iter();
    }
}

export class Timer {
    constructor() {
        this.clock = 0;
        this.postponed = [];
    }
    postpone(time, callback) {
        const pf = [];
        for (const record of this.postponed) {
            if (time==null || record.time < time) {
                pf.push(record);
            } else {
                pf.push({time, callback});
                pf.push(record);
                time = null;
            }
        }
        if (time!=null) {
            pf.push({time, callback});
        }
        this.postponed = pf;
    }
    now() {
        return this.clock;
    }
    hasPostponed() {
        return this.postponed.length > 0;
    }
    tick() {
        this.clock += 1;
        let hadProgress = false;
        while (this.postponed.length > 0 && (this.postponed[0].time < this.clock)) {
            hadProgress = true;
            const record = this.postponed.shift();
            (record.callback)();
        }
        return hadProgress;
    }
}

export class MessageFileChecker {
    constructor(path) {
        var contents = fs.readFileSync(path, 'utf8');
        this.events = contents.split("\n");
    }
    log(message) {
        const income = JSON.stringify(message);
        const expected = this.events.shift();
        if (income != expected) {
            console.info(income);
            console.info(expected);
            throw new Error("Unexpected events");
        }
    }
    flush() { }
}

export class MessageFileLogger {
    constructor(path) {
        this.file = fs.openSync(path, "w");
    }
    log(message) {
        fs.writeSync(this.file, JSON.stringify(message) + "\n");
    }
    flush() {
        fs.closeSync(this.file);
    }
}

export class Bus {
    constructor(loop) {
        this.loop = loop;
    }
    uuid() {
        return this.loop.uuid(); 
    }
    send(message) {
        this.loop.deliver(message);
    }
    *inbox(id) {
        yield* this.loop.inbox(id);
    }
}

export class LoosingBus {
    constructor(bus, random, stability) {
        this.bus = bus;
        this.random = random;
        this.stability = stability;
    }
    uuid() {
        return this.bus.uuid(); 
    }
    send(message) {
        if (this.random() <= this.stability) {
            this.bus.send(message);
        }
    }
    *inbox(id) {
        yield* this.bus.inbox(id);
    }
}

export class ShufflingBus {
    constructor(bus, timer, random) {
        this.bus = bus;
        this.timer = timer;
        this.random = random;
    }
    uuid() {
        return this.bus.uuid(); 
    }
    send(message) {
        this.timer.postpone(this.timer.now() + this.random() * 10, () => {
            this.bus.send(message);
        });
    }
    *inbox(id) {
        yield* this.bus.inbox(id);
    }
}