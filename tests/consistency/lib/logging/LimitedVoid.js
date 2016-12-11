import fs from "fs";

export class LimitedVoid {
    static w({limit}) {
        return () => new LimitedVoid(limit);
    }
    constructor(limit) {
        this.records = 0;
        this.error = null;
        this.handlers = [];
        this.limit = limit;
    }
    log(request) {
        this.records++;

        if (this.records > this.limit) {
            this.error = new Error(
                "Limit is reached (" + this.limit + ")"
            );
            for (let handler of this.handlers) {
                try {
                    handler(this.error);
                } catch (e) {
                    console.info("WAT23");
                    console.info(e); 
                }
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