class Timer {
    constructor(max_time_delay) {
        this.ts = 0;
        this.max_time_delay = max_time_delay;
        this.storage = new Map();
        this.postponed = 0;
        this.hasFailed = false;
        this.thread = null;
    }

    start() {
        this.thread = new Promise((resolve, reject) => {
            const iter = () => {
                if (this.postponed > 0) {
                    try {
                        this.tick();
                        setTimeout(iter, 0);
                    } catch(e) {
                        reject(e);
                    }
                } else {
                    resolve(0);
                }
            };
            iter();
        });
    }
    
    now() { 
        return this.ts;
    }

    async yield() {
        // to put each while's iteration as a new event in the event loop  
        await new Promise((reply, reject) => {
            this.postpone(0, () => reply(null));
        });
    }
    
    postpone(delay, action) { 
        if (delay<0) throw new Error();
        if (delay>this.max_time_delay) throw new Error();

        delay += this.ts;
        this._storage_get(delay).push(action);
        this.postponed += 1;
    }
    
    tick() {
        var now = this.now();
        this.ts += 1;
        var ticks = this._storage_get(now);
        this.storage.delete(now);
        for (let tick of ticks) {
            try {
                tick();
            } catch(e) {
                console.info(":(");
                this.hasFailed = true;
                throw new Error(e);
            }
        }
        this.postponed -= ticks.length;
    }
    
    _storage_get(delay) {
        if (!this.storage.has(delay)) {
            this.storage.set(delay, []);
        }
        return this.storage.get(delay);
    }
}

exports.Timer = Timer;