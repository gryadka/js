const {Tick} = require("./Tick");
const {redisAsyncClient} = require("./utils/redisAsyncClient");

class AcceptorClient {
    constructor(settings) {
        this.settings = settings;
    }
    start() {
        this.redis = redisAsyncClient(this.settings.storage.port, this.settings.storage.host);
    }
    close() {
        this.redis.quit();
    } 
    prepare(key, tick, extra) {
        return this.redis.evalshaAsync(this.settings.prepare, 2, key, tick.stringify()).then(reply => {
            const tick = Tick.parse(reply[1]);
            if (reply[0] === "ok") {
                return respond(this, { isPrepared: true, tick: tick, value: tick.isZero() ? null : JSON.parse(reply[2]).value });
            } else {
                return respond(this, { isConflict: true, tick: tick });
            }
        }).catch(err => respond(this, {isError: true}));
    }
    accept(key, tick, state, extra) {
        return this.redis.evalshaAsync(this.settings.accept, 3, key, tick.stringify(), JSON.stringify({"value": state})).then(reply => {
            if (reply[0] === "ok") {
                return respond(this, { isOk: true});
            } else {
                return respond(this, { isConflict: true, tick: Tick.parse(reply[1]) });
            }
        }).catch(err => respond(this, {isError: true})); 
    }
}

function respond(acceptor, msg) {
    return { acceptor, msg };
}

exports.AcceptorClient = AcceptorClient;