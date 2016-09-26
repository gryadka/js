import seedrandom from "seedrandom"

export default class Shuffler {
    constructor(receiver, seed, msgsPerClient) {
        this.receiver = receiver;
        this.clients = new Map();
        this.isOn = false;
        this.random = seedrandom(seed);
        this.msgsPerClient = msgsPerClient;
    }

    on() {
        this.isOn = true;
        this.receiver.on()
    }
    
    off() {
        this.isOn = false;
        this.sendSlicedClients(x => ({ toSend: x, toKeep: [] }));
        this.receiver.off()
    }

    receive(event) {
        try {
            if (this.isOn && (event.msg.cmd == "prepare" || event.msg.cmd == "accept")) {
                if (!this.clients.has(event.msg.proposerId)) {
                    this.clients.set(event.msg.proposerId, []);
                }

                this.clients.get(event.msg.proposerId).push(event);

                var allHasN = true;
                for (var [_, events] of this.clients) {
                    allHasN = allHasN && events.length == this.msgsPerClient;
                }

                if (allHasN) {
                    this.sendSlicedClients(x => {
                        var [toSend, toKeep] = split(x, this.msgsPerClient);
                        return { toSend, toKeep };
                    });
                }
            } else {
                this.receiver.receive(event);
            }
        } catch (e) {
            console.info("WTF?!");
            console.info(e);
        }
    }

    sendSlicedClients(slicer) {
        var result = [];
        for (const key of this.clients.keys()) {
            const {toSend, toKeep} = slicer(this.clients.get(key)); 
            this.clients.set(key, toKeep);
            Array.prototype.push.apply(result, toSend);
        }
        result = shuffle(() => this.random(), result);
        for (const postponed of result) {
            this.receiver.receive(postponed);
        }
    }
}

function split(arr, n) {
    return [arr.slice(0,n), arr.slice(n)];
}

function shuffle(random, a) {
    var j, x, i;
    for (i = a.length; i; i--) {
        j = Math.floor(random() * i);
        x = a[i - 1];
        a[i - 1] = a[j];
        a[j] = x;
    }
    return a;
}