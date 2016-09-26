import fs from "fs";

export class NetworkLogger {
    constructor(receiver, fileName) {
        this.fileName = fileName;
        this.file = null;
        this.receiver = receiver;
    }
    on() {
        this.file = fs.openSync(this.fileName, "w");
        this.receiver.on();
    }
    off() {
        this.receiver.off();
        fs.closeSync(this.file);
    }
    receive(event) {
        fs.writeSync(this.file, JSON.stringify(event.msg) + "\n");
        this.receiver.receive(event);
    }
}
