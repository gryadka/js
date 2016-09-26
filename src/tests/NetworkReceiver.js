export class NetworkReceiver {
    constructor() {
        this.acceptors = new Map();
    }
    registerAcceptor(id, acceptor) {
        if (this.acceptors.has(id)) {
            throw "ERRNO012";
        }
        this.acceptors.set(id, acceptor);
    }
    on() {}
    off() {}
    receive(event) {
        if (event.msg.cmd == "prepare") {
            const acceptor = this.acceptors.get(event.msg.id);
            event.callback(acceptor.prepare(event.msg.proposerId, event.msg.key, event.msg.tick));
        } else if (event.msg.cmd == "accept") {
            const acceptor = this.acceptors.get(event.msg.id);
            event.callback(acceptor.accept(event.msg.proposerId, event.msg.key, event.msg.tick, event.msg.state));
        } else if (event.msg.cmd == "fastforward") {
            event.callback();
        } else {
            console.info(event);
        }
    }
}

export function listenBusAsync(bus, receiver) {
    return (async function() {
        while (true) {
            receiver.receive(await bus.receive());
        }
    })().catch(e => console.info(e));
}