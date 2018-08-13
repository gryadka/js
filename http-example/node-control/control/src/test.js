const redis = require("redis");
const Promise = require("bluebird");

Promise.promisifyAll(redis.RedisClient.prototype);

// init-1
// 1-to-3
// 3-to-2

const {change, registerChange, getConfiguration, postConfiguration, UnexpectedError, UnexpectedResponseError, PrepareError, CommitError, UnknownChangeFunctionError, ConcurrentRequestError, UpdateError, ProposerIsOff} = require("gryadka-example-http-proposer-client");

class RetryLimitExhausted extends Error {
    constructor() {
        super()
    }
}

if (process.argv.length < 3) {
    help();
    process.exit(1);
}

if (!["ls", "wipe", "add-accept", "rm-accept", "rm-prepare", "add-prepare", "rescan", "dump"].some(x => x==process.argv[2])) {
    help();
    process.exit(1);
}

const proposers = [
    ["proposer-1", 8080],
    ["proposer-2", 8080]
];

const acceptors = [
    ["acceptor-1", 6379],
    ["acceptor-2", 6379],
    ["acceptor-3", 6379]
]

if (process.argv[2]=="ls") {
    ls();
} else if (process.argv[2]=="wipe") {
    wipe(process.argv[3]);
} else if (process.argv[2]=="add-accept") {
    addToAccept(process.argv[3], process.argv[4], parseInt(process.argv[5]));
} else if (process.argv[2]=="rm-accept") {
    rmFromAccept(process.argv[3], process.argv[4], parseInt(process.argv[5]));
} else if (process.argv[2]=="rescan") {
    rescan(process.argv[3], parseInt(process.argv[4]));
} else if (process.argv[2]=="add-prepare") {
    addToPrepare(process.argv[3], process.argv[4], parseInt(process.argv[5]));
} else if (process.argv[2]=="rm-prepare") {
    rmFromPrepare(process.argv[3], process.argv[4], parseInt(process.argv[5]));
} else if (process.argv[2]=="dump") {
    dump();
} else {
    console.info("Unsupported command");
}

async function ls() {
    console.info(`Known proposers:`);
    for (let [host, port] of proposers) {
        console.info(`\t${host}:${port}`);
    }
    console.info();
    console.info(`Known acceptors:`);
    for (let [host, port] of acceptors) {
        console.info(`\t${host}:${port}`);
    }
}

async function wipe(selector) {
    for (let [host, port] of proposers) {
        if (`${host}:${port}` == selector) {
            await wipeProposer(host, port);
            return;
        } else if ("all" == selector) {
            await wipeProposer(host, port)
        }
    }

    if ("all" != selector) {
        console.info(`Usupported wipe selectorument: ${selector}`);
        process.exit(1);
    }

    async function wipeProposer(host, port) {
        console.info(`Updating ${host}:${port} to have empty configuration`);
    
        let proposer = `http://${host}:${port}`;
    
        let config = await getConfiguration(proposer);
        config.accept.quorum = 0;
        config.accept.nodes = [];
        config.prepare.quorum = 0;
        config.prepare.nodes = [];
    
        saveConfig(proposer, config);
    }
}

async function addToAccept(proposer, acceptor, quorum) {
    acceptor = getAcceptor(acceptor);
    
    if (proposer == "all") {
        for (let [host, port] of proposers) {
            await addAcceptorToAccept(`http://${host}:${port}`, acceptor, quorum);
            
            await new Promise(resolve => {
                setTimeout(() => resolve(null), 10000);
            });
        }
    } else {
        let [host, port] = getProposer(proposer);
        await addAcceptorToAccept(`http://${host}:${port}`, acceptor, quorum);
    }

    async function addAcceptorToAccept(proposer, acceptor, quorum) {
        console.info(`Adding ${acceptor[0]}:${acceptor[1]} to ${proposer}'s accept list, set quorum to ${quorum}`);

        let config = await getConfiguration(proposer);
        
        if (config.accept.nodes.some(
            node => node.host == acceptor[0] && node.port == acceptor[1]
        )) {
            console.info("\tAcceptor already added");
        } else {
            config.accept.nodes.push({
                "host": acceptor[0],
                "port": acceptor[1]
            });
        }

        if (config.accept.quorum == quorum) {
            console.info("\tQuorum already set");
        }

        config.accept.quorum = quorum;

        saveConfig(proposer, config);
    }
}

async function rmFromAccept(proposer, acceptor, quorum) {
    acceptor = getAcceptor(acceptor);
    
    if (proposer == "all") {
        for (let [host, port] of proposers) {
            await rmAcceptorFromAccept(`http://${host}:${port}`, acceptor, quorum);
            
            await new Promise(resolve => {
                setTimeout(() => resolve(null), 10000);
            });
        }
    } else {
        let [host, port] = getProposer(proposer);
        await rmAcceptorFromAccept(`http://${host}:${port}`, acceptor, quorum);
    }

    async function rmAcceptorFromAccept(proposer, acceptor, quorum) {
        console.info(`Removing ${acceptor[0]}:${acceptor[1]} from ${proposer}'s accept list, set quorum to ${quorum}`);

        let config = await getConfiguration(proposer);
        
        if (config.accept.nodes.some(
            node => node.host == acceptor[0] && node.port == acceptor[1]
        )) {
            config.accept.nodes = config.accept.nodes.filter(
                node => !(node.host == acceptor[0] && node.port == acceptor[1])
            );
        } else {
            console.info("\tAcceptor already removed");
        }

        if (config.accept.quorum == quorum) {
            console.info("\tQuorum already set");
        }

        config.accept.quorum = quorum;

        saveConfig(proposer, config);
    }
}

async function rescan(sources, required) {
    const keys = new Set();
    const errors = [];
    let respondedAcceptors = 0;
    for (const [host, port] of sources.split(",").map(x => getAcceptor(x))) {
        if (respondedAcceptors == required) break;
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

    if (respondedAcceptors < required) {
        console.info(`Failed to fetch keys from ${required} acceptors, try later`);
        for (const err of errors) {
            console.info(err);
        }
        process.exit(1);
    }

    console.info(`Keys to rescan: ${keys.size}`);

    for (const key of keys.values()) {
        await ((async () => {
            while (true) {
                for (const [host, port] of proposers) {
                    let proposer = `http://${host}:${port}`;
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

async function addToPrepare(proposer, acceptor, quorum) {
    acceptor = getAcceptor(acceptor);
    
    if (proposer == "all") {
        for (let [host, port] of proposers) {
            await addAcceptorToPrepare(`http://${host}:${port}`, acceptor, quorum);
            
            await new Promise(resolve => {
                setTimeout(() => resolve(null), 10000);
            });
        }
    } else {
        let [host, port] = getProposer(proposer);
        await addAcceptorToPrepare(`http://${host}:${port}`, acceptor, quorum);
    }

    async function addAcceptorToPrepare(proposer, acceptor, quorum) {
        console.info(`Adding ${acceptor[0]}:${acceptor[1]} to ${proposer}'s prepare list, set prepare's quorum to ${quorum}`);

        let config = await getConfiguration(proposer);
        
        if (config.prepare.nodes.some(
            node => node.host == acceptor[0] && node.port == acceptor[1]
        )) {
            console.info("\tAcceptor already added");
        } else {
            config.prepare.nodes.push({
                "host": acceptor[0],
                "port": acceptor[1]
            });
        }

        if (config.prepare.quorum == quorum) {
            console.info("\tQuorum already set");
        }

        config.prepare.quorum = quorum;

        saveConfig(proposer, config);
    }
}

async function rmFromPrepare(proposer, acceptor, quorum) {
    acceptor = getAcceptor(acceptor);
    
    if (proposer == "all") {
        for (let [host, port] of proposers) {
            await rmAcceptorFromPrepare(`http://${host}:${port}`, acceptor, quorum);
            
            await new Promise(resolve => {
                setTimeout(() => resolve(null), 10000);
            });
        }
    } else {
        let [host, port] = getProposer(proposer);
        await rmAcceptorFromPrepare(`http://${host}:${port}`, acceptor, quorum);
    }

    async function rmAcceptorFromPrepare(proposer, acceptor, quorum) {
        console.info(`Removing ${acceptor[0]}:${acceptor[1]} from ${proposer}'s prepare list, set quorum to ${quorum}`);

        let config = await getConfiguration(proposer);
        
        if (config.prepare.nodes.some(
            node => node.host == acceptor[0] && node.port == acceptor[1]
        )) {
            config.prepare.nodes = config.prepare.nodes.filter(
                node => !(node.host == acceptor[0] && node.port == acceptor[1])
            );
        } else {
            console.info("\tAcceptor already removed");
        }

        if (config.prepare.quorum == quorum) {
            console.info("\tQuorum already set");
        }

        config.prepare.quorum = quorum;

        saveConfig(proposer, config);
    }
}

async function dump() {
    for (let [host, port] of proposers) {
        let proposer = `http://${host}:${port}`;
        console.info(`######################`);
        console.info(`# ${proposer}`);
        console.info(`######################`);
        const config = await getConfiguration(proposer);
        console.info(JSON.stringify(config, null, "  "));
        console.info();
    }
}

async function saveConfig(proposer, config) {
    try { 
        await postConfiguration(proposer, config);
    } catch(e) {
        if ((e instanceof UnexpectedError) && e.err.code == "ECONNRESET") {
            // ok: reboot of proposer causes this error
        } else {
            console.info(e);
            process.exit(1);
        }
    }
}

function getAcceptor(acceptor) {
    for (let [host, port] of acceptors) {
        if (`${host}:${port}` == acceptor) {
            return [host, port];
        }
    }

    console.info(`Unknown acceptor: ${acceptor}`);
    process.exit(1);
}

function getProposer(proposer) {
    for (let [host, port] of proposers) {
        if (`${host}:${port}` == proposer) {
            return [host, port];
        }
    }

    console.info(`Unknown proposer: ${proposer}`);
    process.exit(1);
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
    console.info("  * ls - list known proposers and acceptors");
    console.info("  * dump - to dump config of proposers");
    console.info("  * wipe `*` - reset configuration to empty on all proposers")
    console.info("  * wipe x - reset x's configuration")
    console.info("  * add-accept x y z - add acceptor y to proposer x's accept list and set accept's quorum to z, it's possible to use all as x to perform op on all proposers");
    console.info("  * rm-accept x y z - remove acceptor y from proposer x's accept list and set accept's quorum to z, it's possible to use all as x to perform op on all proposers");
    console.info("  * rescan x,y z - fetch keys from z subset of x,y; union them and re-read every key");
    console.info("  * add-prepare x y z - add acceptor y to proposer x's prepare list and set prepare's quorum to z, it's possible to use all as x to perform op on all proposers");
    console.info("  * rm-prepare x y z - remove acceptor y from proposer x's prepare list and set prepare's quorum to z, it's possible to use all as x to perform op on all proposers");
}