import fs from "fs";

export class NetworkChecker {
    constructor(receiver, fileName) {
        this.fileName = fileName;
        this.receiver = receiver;
        this.events = null;
    }
    on() {
        var contents = fs.readFileSync(this.fileName, 'utf8');
        this.events = contents.split("\n");
        this.receiver.on();
    }
    off() {
        this.receiver.off();
    }
    receive(event) {
        const income = JSON.stringify(event.msg);
        const expected = this.events.shift();
        if (income != expected) {
            console.info(income);
            console.info(expected);
            throw new Error("Unexpected events");
        }
        this.receiver.receive(event);
    }
}
