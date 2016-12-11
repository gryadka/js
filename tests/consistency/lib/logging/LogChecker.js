import fs from "fs";

export class LogChecker {
    static w({path}) {
        return () => new LogChecker(path);
    }
    constructor(path) {
        var contents = fs.readFileSync(path, 'utf8');
        this.storage = contents.split("\n");
        this.i = 0;
        this.error = null;
        this.handlers = [];
    }
    log(request) {
        if (!this.error) {
            const expected = this.storage[this.i];
            const actual = request;
            if (expected != actual) {
                this.error = new Error(
                    "Expected packet doesn't match actual\n" +
                    "  actual:   " + actual + "\n"+
                    "  expected: " + expected
                );
                for (let handler of this.handlers) {
                    try {
                        handler(this.error);
                    } catch (e) {
                        console.info("WAT21");
                        console.info(e); 
                    }
                }
            } else {
                this.i+=1;
            }
        } 
    }
    flush() { }
    onError(handler) { 
        if (this.error) {
            handler(this.error);
        } else {
            this.handlers.push(handler);
        }
    }
}
