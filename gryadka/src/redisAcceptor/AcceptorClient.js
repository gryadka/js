const {BallotNumber} = require("./BallotNumber");
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
    async prepare(key, ballot, extra) {
        try {
            const reply = await this.redis.evalshaAsync(this.settings.prepare, 3, key, ballot.counter, ballot.id);
            const acceptedBallot = new BallotNumber(parseInt(reply[1]), reply[2]);
            if (reply[0] === "ok") {
                const acceptedValue = acceptedBallot.isZero() ? null : JSON.parse(reply[3]).value;
                return { isPrepared: true, ballot: acceptedBallot, value: acceptedValue };
            } else {
                return { isConflict: true, ballot: acceptedBallot };
            }
        } catch (e) {
            return {isError: true};
        }
    }
    accept(key, ballot, state, promise, extra) {
        try {
            const reply = await this.redis.evalshaAsync(this.settings.accept, 6, key, ballot.counter, ballot.id, JSON.stringify({"value": state}), promise.counter, promise.id);
            
            if (reply[0] === "ok") {
                return { isOk: true};
            } else {
                return { isConflict: true, ballot: new BallotNumber(parseInt(reply[1]), reply[2]) };
            }
        } catch (e) {
            return {isError: true};
        }
    }
}

exports.AcceptorClient = AcceptorClient;