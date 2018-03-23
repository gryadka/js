const redis = require("redis");
const Promise = require("bluebird");
const {BallotNumber} = require("../BallotNumber");

Promise.promisifyAll(redis.RedisClient.prototype);

class AcceptorClient {
    constructor(host, port) {
        this.host = host;
        this.port = port;
        this.redis = null;
        this.connecting = false;
        this.prepareHash = null;
        this.acceptHash = null;
    }
    
    async connect() {
        if (this.redis != null) return this.redis;
        if (this.connecting) throw new Error();
        this.connecting = true;
        
        let client = null;
        try {
            client = redis.createClient({port: this.port, host: this.host, retry_strategy: options=>2000});
            this.prepareHash = await client.getAsync("prepare");
            this.acceptHash = await client.getAsync("accept");
        } catch(e) {
            console.info("connecting")
            console.info(e);
            try { client.quit(); } catch(_) {}
            throw e;
        } finally {
            this.connecting = false;
        }
        this.redis = client;
        return client;
    }

    reset() {
        if (this.redis != null) {
            const client = this.redis;
            this.redis = null;
            try { client.quit() } catch(e) { }
        }
    }
    
    async prepare(key, ballot, extra) {
        try {
            const client = await this.connect();
            console.info(`prepare(${key}, ${ballot.stringify()})`);
            const reply = await client.evalshaAsync(this.prepareHash, 2, key, ballot.stringify());
            const acceptedBallot = BallotNumber.parse(reply[1]);
            if (reply[0] === "ok") {
                console.info("acceptedBallot");
                console.info("\"" + acceptedBallot.stringify() + "\"");
                const acceptedValue = acceptedBallot.isZero() ? null : JSON.parse(reply[2]).value;
                return { isPrepared: true, ballot: acceptedBallot, value: acceptedValue };
            } else {
                return { isConflict: true, ballot: acceptedBallot };
            }
        } catch (e) {
            console.info("preparing")
            console.info(e);
            this.reset();
            return {isError: true};
        }
    }
    async accept(key, ballot, state, promise, extra) {
        try {
            const client = await this.connect();
            console.info(`accept(${key}, ${ballot.stringify()}, ${JSON.stringify({"value": state})}, ${promise.stringify()})`);
            const reply = await client.evalshaAsync(this.acceptHash, 4, key, ballot.stringify(), JSON.stringify({"value": state}), promise.stringify());
            
            if (reply[0] === "ok") {
                console.info("accepted: ok");
                return { isOk: true};
            } else {
                console.info(`accepted: conflict: ${reply[0]} - ${reply[1]}`);
                console.info(`my: ${ballot.stringify()}`);
                return { isConflict: true, ballot: BallotNumber.parse(reply[1]) };
            }
        } catch (e) {
            console.info("accepting");
            console.info(e);
            this.reset();
            return {isError: true};
        }
    }
}

exports.AcceptorClient = AcceptorClient;