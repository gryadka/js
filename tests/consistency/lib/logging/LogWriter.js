const fs = require("fs");

class LogWriter {
    static w({path}) {
        return () => new LogWriter(path);
    }
    constructor(path) {
        this.storage = [];
        this.file = fs.openSync(path, "w");
        this.records = 0;
        this.error = null;
        this.handlers = [];
    }
    log(request) {
        this.run(() => {
            this.storage.push(request);
            this.records++;

            if (this.storage.length > 400) {
                const content = this.storage.join("\n") + "\n";
                fs.writeSync(this.file, content);    
                this.storage = [];
            }
        });
    }

    run(action) {
        if (!this.error) {
            try {
                action();
            } catch (e) {
                this.error = e;
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
    }

    flush() {
        this.run(() => {
            if (this.storage.length > 0) {
                const content = this.storage.join("\n") + "\n";
                fs.writeSync(this.file, content);
            }
            fs.closeSync(this.file);
        });
    }

    onError(handler) { 
        if (this.error) {
            handler(this.error);
        } else {
            this.handlers.push(handler);
        }
    }
}

exports.LogWriter = LogWriter