const express = require("express");
const bodyParser = require("body-parser");
const Config = require("./src/config");
const proposerByConfig = require("./src/proposerByConfig");
const HttpProposer = require("./src/HttpProposer");

(async () => {
    if (process.argv.length != 3) {
        console.info("conf dir is expected as argument");
        process.exit(1);
    }
    await startHttpProposer(process.argv[2], 8080);
})()

async function startHttpProposer(dir, port) {
    const config = await Config.read(dir);
    config.configVersion+=1;
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