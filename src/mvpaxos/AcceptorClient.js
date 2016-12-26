import {Tick} from "./Time";
import redisAsyncClient from "./utils/redisAsyncClient";

export default class AcceptorClient {
    constructor(settings) {
        this.settings = settings;
    }
    get isBeingIntroduce() {
        return this.settings.isBeingIntroduce
    }
    start() {
        this.redis = redisAsyncClient(this.settings.storage.port, this.settings.storage.host);
    }
    close() {
        this.redis.quit();
    }
    // todo: proposerId 
    prepare(proposerId, key, tick, extra) {
        return this.redis.evalshaAsync(this.settings.prepare, 2, this.settings.storage.prefix + "/" + key, str_tick(tick)).then(reply => {
            const tick = parse_tick(reply[1]);
            if (reply[0] === "ok") {
                return respond(this, { isPrepared: true, tick: tick, state: tick.eon==0 ? null : JSON.parse(reply[2]).value });
            } else {
                return respond(this, { isConflict: true, tick: tick });
            }
        }).catch(err => respond(this, {isError: true}));
    }
    // todo: proposerId
    accept(proposerId, key, tick, state, extra) {
        return this.redis.evalshaAsync(this.settings.accept, 3, this.settings.storage.prefix + "/" + key, str_tick(tick), JSON.stringify({"value": state})).then(reply => {
            if (reply[0] === "ok") {
                return respond(this, { isOk: true});
            } else {
                return respond(this, { isConflict: true, tick: parse_tick(reply[1]) });
            }
        }).catch(err => respond(this, {isError: true})); 
    }
}

function respond(acceptor, msg) {
    return { acceptor, msg };
}

function str_tick(tick) {
    return tick.join(",");
}

function parse_tick(txt_tick) {
    return Tick.fromJSON(txt_tick.split(",").map(x=>parseInt(x)));
}