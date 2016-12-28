import Cache from "../src/mvpaxos/Cache";
import AcceptorClient from "../src/mvpaxos/AcceptorClient";
import Proposer from "../src/mvpaxos/Proposer";
import redisAsyncClient from "../src/mvpaxos/utils/redisAsyncClient";

import fs from "fs"
import readline from "readline"

class Syncer {
    async start(settings) {
        const eonKey = settings.storage.prefix + "/eon";
        this.redis = redisAsyncClient(settings.storage.port, settings.storage.host);

        const cache = new Cache(settings.id);

        this.acceptors = settings.acceptors.map(x => new AcceptorClient(x));
        this.acceptors.forEach(x => x.start());

        this.proposer = new Proposer(cache, this.acceptors, settings.quorum);

        return this;
    }

    async sync(key) {
        return await this.proposer.changeQuery(key, state => [state, null],  x => x);
    }

    close() {
        this.acceptors.forEach(x => x.close());
        this.redis.quit();
    }
}

const settings = JSON.parse(fs.readFileSync(process.argv[2]));
console.info(settings);

var keys = fs.readFileSync(settings.keys).toString().split("\n").filter(x => x != "");

(async function() {
    var syncer = null;
    try {
        syncer = await new Syncer().start(settings.syncer);
        for (const key of keys) {
            while (true) {
                const result = await syncer.sync(key);
                if (result.status=="OK") {
                    console.info("synced: " + key);
                    break;
                }
            } 
        }
        syncer.close();
    } catch (error) {
        console.info(error);
        if (syncer != null) {
            syncer.close();
        }
    }
})();
