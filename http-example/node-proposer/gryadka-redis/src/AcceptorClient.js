const redis = require("redis");
const Promise = require("bluebird");

Promise.promisifyAll(redis.RedisClient.prototype);

class AcceptorClient {
    constructor(host, port, parseBallotNumber) {
        this.parseBallotNumber = parseBallotNumber;
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
            const reply = await client.evalshaAsync(this.prepareHash, 2, key, ballot.stringify());
            const acceptedBallot = this.parseBallotNumber(reply[1]);
            if (reply[0] === "ok") {
                const acceptedValue = acceptedBallot.isZero() ? null : JSON.parse(reply[2]).value;
                return { isPrepared: true, ballot: acceptedBallot, value: acceptedValue };
            } else {
                return { isConflict: true, ballot: acceptedBallot };
            }
        } catch (e) {
            this.reset();
            return {isError: true};
        }
    }
    async accept(key, ballot, state, promise, extra) {
        try {
            const client = await this.connect();
            const reply = await client.evalshaAsync(this.acceptHash, 4, key, ballot.stringify(), JSON.stringify({"value": state}), promise.stringify());
            
            if (reply[0] === "ok") {
                return { isOk: true};
            } else {
                return { isConflict: true, ballot: this.parseBallotNumber(reply[1]) };
            }
        } catch (e) {
            this.reset();
            return {isError: true};
        }
    }
}

exports.AcceptorClient = AcceptorClient;