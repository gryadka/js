import fs from "fs";


import mustache from "mustache";

class RedisEtcWriter {
    constructor(redisTemplatePath, deploymentPath) {
        this.redisTemplatePath = redisTemplatePath;
        this.deploymentPath = deploymentPath;
    }
    write(id, params) {
        const etc = this.prepareAcceptorEtc(id, params);
        this.writeAcceptorEtc(id, etc);
    }
    prepareAcceptorEtc(id, params) {
        return {
            pidfile: this.deploymentPath + id + "/redis.pid",
            port: params.port,
            dir: this.deploymentPath + id + "/",
            dbfilename: "dump.rdb",
            appendfilename: "appendonly.aof"
        };
    }
    writeAcceptorEtc(id, etc) {
        const template = fs.readFileSync(this.redisTemplatePath, 'utf8');
        const content = mustache.render(template, etc);
        const file = fs.openSync(this.deploymentPath + id + "/redis.conf", "w");
        fs.writeSync(file, content);
        fs.closeSync(file);
    }
}

const cluster = JSON.parse(fs.readFileSync(process.argv[2]));
cluster.acceptors = asMap(cluster.acceptors);
cluster.proposers = asMap(cluster.proposers);

if (process.argv[3] == "redis") {
    redis(cluster, process.argv[4], process.argv[5] + "/deployment/");
} else if (process.argv[3] == "proposer") {
    proposer(cluster, process.argv[4] + "/deployment/");
} else if (process.argv[3] == "acceptors") {
    acceptors(cluster);
} else if (process.argv[3] == "load-lua") {
    loadLua(cluster);
} else {
    throw new Error("Unknown command: " + process.argv[3])
}

function loadLua(cluster) {
    for (const key of cluster.acceptors.keys()) {
        console.info(`${key} ${cluster.acceptors.get(key).port}`);
    }
}

function acceptors(cluster) {
    for (const key of cluster.acceptors.keys()) {
        console.info(key);
    }
}

function redis(cluster, redisTemplatePath, deploymentPath) {
    for (const key of cluster.acceptors.keys()) {
        new RedisEtcWriter(redisTemplatePath, deploymentPath).write(key, cluster.acceptors.get(key));
    }
}

function proposer(cluster, deploymentPath) {
    for (const key of cluster.acceptors.keys()) {
        Object.assign(cluster.acceptors.get(key), {
            accept: fs.readFileSync(deploymentPath + key + "/accept.hash", 'utf8').trim(),
            prepare: fs.readFileSync(deploymentPath + key + "/prepare.hash", 'utf8').trim(),
        });
    }

    for (const key of cluster.proposers.keys()) {
        const p = cluster.proposers.get(key);
        const settings = {
            id: p.id,
            port: p.port,
            quorum: p.quorum,
            acceptors: p.acceptors.map(aid => {
                const a = cluster.acceptors.get(aid);
                return {
                    prepare: a.prepare,
                    accept: a.accept,
                    storage: {
                        host: "127.0.0.1",
                        port: a.port
                    },
                    isBeingIntroduce: p.transient.includes(aid)
                };
            })
        };
        const file = fs.openSync(`${deploymentPath}proposers/${key}.json`, "w");
        fs.writeSync(file, JSON.stringify(settings, null, "  "));
        fs.closeSync(file);
    }
}

function asMap(obj) {
    let map = new Map();
    Object.keys(obj).forEach(key => {
        map.set(key, obj[key]);
    });
    return map;
}