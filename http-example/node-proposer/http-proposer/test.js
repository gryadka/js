const express = require("express");
const bodyParser = require("body-parser");
const Config = require("./src/config");
const proposerByConfig = require("./src/proposerByConfig");
const HttpProposer = require("./src/HttpProposer");

const proposerIds = new Map([
    ["proposer-1", "p1"],
    ["proposer-2", "p2"]
]);

(async () => {
    if (process.argv.length != 4) {
        console.info("conf dir and hostname are expected as arguments");
        process.exit(1);
    }
    if (!proposerIds.has(process.argv[3])) {
        console.info(`unknown host: ${process.argv[3]} can't map to proposerId`);
        process.exit(1);
    }
    await startHttpProposer(proposerIds.get(process.argv[3]), process.argv[2], 8080);
})()

async function startHttpProposer(proposerId, dir, port) {
    const config = await Config.read(dir);
    config.configVersion+=1;
    config.proposerId=proposerId
    await Config.write(dir, config);
    const proposer = new HttpProposer(dir, config, proposerByConfig(config));
    
    const app = express();
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser());
    const router = express.Router();

    router.route("/register-change").post((req, res) => {
        proposer.registerChange(req, res);
    });
    router.route("/change").post((req, res) => {
        proposer.change(req, res);
    });
    router.route("/configuration").get((req, res) => {
        proposer.getConfiguration(req, res);
    });
    router.route("/configuration").post((req, res) => {
        proposer.updateConfiguration(req, res);
    });

    app.use('/', router);
    return app.listen(port);
}