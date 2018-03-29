const redis = require("redis");
const Promise = require("bluebird");

Promise.promisifyAll(redis.RedisClient.prototype);

const {change, registerChange, getConfiguration, postConfiguration, UnexpectedError, UnexpectedResponseError, PrepareError, CommitError, UnknownChangeFunctionError, ConcurrentRequestError, UpdateError, ProposerIsOff} = require("lib-http-proposer-api");

class RetryLimitExhausted extends Error {
    constructor() {
        super()
    }
}

if (process.argv.length < 3) {
    help();
    process.exit(1);
}

if (!["accept", "rescan", "prepare", "dump"].some(x => x==process.argv[2])) {
    help();
    process.exit(1);
}

const proposers = [
    "http://acceptor-proposer-1:8080",
    "http://acceptor-proposer-2:8080",
    "http://acceptor-proposer-3:8080"
];

const acceptros = [
    ["acceptor-proposer-1", 6379],
    ["acceptor-proposer-2", 6379],
    ["acceptor-proposer-3", 6379]
]

if (process.argv[2]=="accept") {
    accept();
} else if (process.argv[2]=="rescan") {
    rescan();
} else if (process.argv[2]=="prepare") {
    prepare();
} else if (process.argv[2]=="dump") {
    dump();
} else {
    console.info("Unsupported command");
}

async function accept() {
    for (let proposer of proposers) {
        console.info(`Updating: ${proposer}`);
        let config = await getConfiguration(proposer);

        if (!config.accept.nodes.some(node => node.host == "acceptor-4")) {
            if (config.accept.quorum != 2) {
                console.info("Something is strange, quorum is expected to be 2");
                console.info(JSON.stringify(config, null, "  "));
                process.exit(1);
            }
            config.accept.quorum = 3;
            config.accept.nodes.push({
                "host": "acceptor-4",
                "port": 6379
            });

            try { 
                await postConfiguration(proposer, config);
            } catch(e) {
                if ((e instanceof UnexpectedError) && e.err.code == "ECONNRESET") {
                    // ok
                } else {
                    console.info(e);
                    throw e;
                }
            }

            await new Promise(resolve => {
                setTimeout(() => resolve(null), 10000);
            });

            const updated = await getConfiguration(proposer);
            if (!updated.accept.nodes.some(node => node.host == "acceptor-4")) {
                console.info("update failed, prease retry");
                process.exit(1);
            }
        } else {
            if (config.accept.quorum != 3) {
                console.info("Something is strange, quorum is expected to be 3");
                console.info(JSON.stringify(config, null, "  "));
                process.exit(1);
            }
            console.info("  Already have: \"acceptor-4\"");
        }
    }
}

async function rescan() {
    const keys = new Set();
    const errors = [];
    let respondedAcceptors = 0
    for (const [host, port] of acceptros) {
        if (respondedAcceptors == 2) break;
        let client = null;
        try {
            client = redis.createClient({port: port, host: host, retry_strategy: options=>2000});
            for (const key of await client.keysAsync("*/promise")) {
                keys.add(key.replace(/([^\/]*)\/promise/, "$1"))
            }
            respondedAcceptors++;
        } catch(e) {
            errors.push(e);
        }
        if (client != null) {
            try { client.quit(); } catch(e) {}
        }
    }

    if (respondedAcceptors < 2) {
        console.info("Failed to fetch keys from quorum of acceptors, try later");
        for (const err of errors) {
            console.info(err);
        }
        process.exit(1);
    }

    for (const key of keys.values()) {
        await ((async () => {
            while (true) {
                for (const proposer of proposers) {
                    try {
                        await id(proposer, key, 30);
                        return;
                    } catch(e) {
                        if (e instanceof RetryLimitExhausted) {
                            console.info(`Can't fetch "${key}" after 30 tries, try later`);
                            process.exit(1);
                        } else if (e instanceof ProposerIsOff) {
                            continue;
                        } else if ((e instanceof UnexpectedError) && e.err.code == "ECONNRESET") {
                            continue;
                        } else if ((e instanceof UnexpectedError) && e.err.code == "ENOTFOUND") {
                            continue;
                        } else if ((e instanceof UnexpectedError) && e.err.code == "ECONNREFUSED") {
                            continue;
                        } else if ((e instanceof UnexpectedError) && e.err.code == "ETIMEDOUT") {
                            continue;
                        }

                        throw e;
                    }
                }
            }
        })());
    }

    console.info("Rescan finished");
}

async function prepare() {
    for (let proposer of proposers) {
        console.info(`Updating: ${proposer}`);
        let config = await getConfiguration(proposer);

        if (!config.prepare.nodes.some(node => node.host == "acceptor-4")) {
            if (config.prepare.quorum != 2) {
                console.info("Something is strange, quorum is expected to be 2");
                console.info(JSON.stringify(config, null, "  "));
                process.exit(1);
            }
            config.prepare.quorum = 3;
            config.prepare.nodes.push({
                "host": "acceptor-4",
                "port": 6379
            });

            try { 
                await postConfiguration(proposer, config);
            } catch(e) {
                if ((e instanceof UnexpectedError) && e.err.code == "ECONNRESET") {
                    // ok
                } else {
                    console.info(e);
                    throw e;
                }
            }

            await new Promise(resolve => {
                setTimeout(() => resolve(null), 10000);
            });

            const updated = await getConfiguration(proposer);
            if (!updated.prepare.nodes.some(node => node.host == "acceptor-4")) {
                console.info("update failed, prease retry");
                process.exit(1);
            }
        } else {
            if (config.prepare.quorum != 3) {
                console.info("Something is strange, quorum is expected to be 3");
                console.info(JSON.stringify(config, null, "  "));
                process.exit(1);
            }
            console.info("  Already have: \"acceptor-4\"");
        }
    }
}

async function dump() {
    for (let proposer of proposers) {
        console.info(`######################`);
        console.info(`# ${proposer}`);
        console.info(`######################`);
        const config = await getConfiguration(proposer);
        console.info(JSON.stringify(config, null, "  "));
        console.info();
    }
}

async function id(endpoint, key, retries) {
    while (true) {
        if (retries == 0) {
            throw new RetryLimitExhausted();
        }
        try {
            retries--;
            await change(endpoint, "id", key, null);
            return;
        } catch (e1) {
            if (e1 instanceof UnknownChangeFunctionError) {
                await registerChange(endpoint, "id", "params => x => x");
                continue;
            } else if (e1 instanceof PrepareError) {
                continue;
            } else if (e1 instanceof CommitError) {
                continue;
            } else if (e1 instanceof ConcurrentRequestError) {
                continue;
            }
            throw e1;
        }
    }
}

function help() {
    console.info("Allowed args:");
    console.info("  * accept - to add acceptor-4 to the accept list on each proposer and increase quorum");
    console.info("  * rescan - to re-read every key");
    console.info("  * prepare - to add acceptor-4 to the accept list on each proposer and increase quorum");
    console.info("  * dump - to dump config of proposers");
}