const {BallotNumber} = require("../BallotNumber");
const {redisAsyncClient} = require("./redisAsyncClient");

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
            const reply = await this.redis.evalshaAsync(this.settings.prepare, 2, key, ballot.stringify());
            const acceptedBallot = BallotNumber.parse(reply[1]);
            if (reply[0] === "ok") {
                const acceptedValue = acceptedBallot.isZero() ? null : JSON.parse(reply[2]).value;
                return { isPrepared: true, ballot: acceptedBallot, value: acceptedValue };
            } else {
                return { isConflict: true, ballot: acceptedBallot };
            }
        } catch (e) {
            return {isError: true};
        }
    }
    async accept(key, ballot, state, promise, extra) {
        try {
            const reply = await this.redis.evalshaAsync(this.settings.accept, 4, key, ballot.stringify(), JSON.stringify({"value": state}), promise.stringify());
            
            if (reply[0] === "ok") {
                return { isOk: true};
            } else {
                return { isConflict: true, ballot: BallotNumber.parse(reply[1]) };
            }
        } catch (e) {
            return {isError: true};
        }
    }
}

exports.AcceptorClient = AcceptorClient;