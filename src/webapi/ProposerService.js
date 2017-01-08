import Cache from "../paxos/Cache";
import {Time} from "../paxos/Time";
import AcceptorClient from "../paxos/AcceptorClient";
import Proposer from "../paxos/Proposer";
import redisAsyncClient from "../paxos/utils/redisAsyncClient";

import express from "express";
import bodyParser from "body-parser";

export class ProposerService {
    async start(settings) {
        const cache = new Cache(settings.id);
        this.acceptors = settings.acceptors.map(x => new AcceptorClient(x));
        this.acceptors.forEach(x => x.start());

        const proposer = new Proposer(cache, this.acceptors, settings.quorum);

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