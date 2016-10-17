import Cache from "../mvpaxos/Cache";
import {Time} from "../mvpaxos/Time";
import AcceptorClient from "../mvpaxos/AcceptorClient";
import Proposer from "../mvpaxos/Proposer";
import redisAsyncClient from "../mvpaxos/utils/redisAsyncClient";

import express from "express";
import bodyParser from "body-parser";

export function proposerServiceFactory(settings) {
    const service = new ProposerService();
    return service.start(settings);
}

class ProposerService {
    async start(settings) {
        const eonKey = settings.storage.prefix + "/eon";
        this.redis = redisAsyncClient(settings.storage.port, settings.storage.host);
        var eon = await this.redis.incrAsync(eonKey);

        console.info("started, eon: " + eon);
        const cache = new Cache();
        const time = new Time(eon, settings.id, eon => {
            return this.redis.evalshaAsync(settings.storage.fastforward, 2, eonKey, eon);
        });

        this.acceptors = settings.acceptors.map(x => new AcceptorClient(x));
        this.acceptors.forEach(x => x.start());

        const proposer = new Proposer(settings.id, cache, this.acceptors, time, settings.quorum, false);

        const app = express();
        app.use(bodyParser.urlencoded({ extended: true }));
        app.use(bodyParser.json());

        const router = express.Router();

        router.route("/change").post(function(req, res) {
            var change = require("./mutators/" + req.body.change.name)(req.body.change.args);
            var query = require("./mutators/" + req.body.query.name)(req.body.query.args);

            proposer.changeQuery(req.body.key, change, query).then(x => {
                res.json(x);
            });
        });

        app.use('/', router);

        this.server = app.listen(settings.port);

        return this;
    }

    close() {
        this.acceptors.forEach(x => x.close());
        this.redis.quit();
        this.server.close();
    }
}