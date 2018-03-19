const {ProposerError} = require("gryadka");
const Config = require("./config");

class HttpProposer {
    constructor(dir, config, proposer) {
        this.dir = dir;
        this.config = config;
        this.proposer = proposer;
        this.changes = new Map();
        this.isOff = false;
    }
    registerChange(req, res) {
        if (this.isOff) {
            res.setHeader('Content-Type', 'application/json');
            res.status(500);
            res.send(JSON.stringify({ "code": "ProposerIsOff" }));
            return;
        }
        let change = null;
        try {
            change = eval(req.body.body);
        } catch(e) {
            res.setHeader('Content-Type', 'application/json');
            res.status(400);
            res.send(JSON.stringify({ "code": "CantEvalBody" }));
            return;
        }
        this.changes.set(req.body.name, change);
        res.sendStatus(200);
    }
    async change(req, res) {
        res.setHeader('Content-Type', 'application/json');
        if (this.isOff) {
            res.status(500);
            res.send(JSON.stringify({ "code": "ProposerIsOff" }));
            return;
        }
        if (!this.changes.has(req.body.name)) {
            res.status(404);
            res.send(JSON.stringify({ "code": "UnknownChangeFunction" }));
        } else {
            const change = this.changes.get(req.body.name);
            let state = null;
            try {
                state = await this.proposer.change(req.body.key, change(req.body.params));
            } catch(e) {
                res.setHeader('Content-Type', 'application/json');
                res.status(400);
                if (e instanceof ProposerError) {
                    res.send(JSON.stringify({ "code": e.code }));
                } else {
                    res.send(JSON.stringify({ "code": "UnknownError" }));
                }
                return;
            }
            res.status(200);
            res.send(JSON.stringify({ "value": state }));
        }
    }
    getConfiguration(req, res) {
        res.setHeader('Content-Type', 'application/json');
        res.status(200);
        res.send(JSON.stringify(this.config));
    }
    async updateConfiguration(req, res) {
        res.setHeader('Content-Type', 'application/json');
        if (req.body.configVersion != this.config.configVersion) {
            res.status(400);
            res.send(JSON.stringify({ code: "ConfigVersionMismatch" }));
        } else {
            this.isOff = true;
            try {
                req.body.configVersion += 1;
                await Config.write(this.dir, req.body);
                process.exit(1);
            } catch(e) {
                res.status(400);
                res.send(JSON.stringify({ code: "ConfigWriteProblem" }));
                return;
            }
        }
    }
}

module.exports = HttpProposer;