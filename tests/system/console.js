import fs from "fs";
import {TUI} from "./tui"
import seedrandom from "seedrandom"
import {Random} from "../consistency/lib/Random"
import {IncConsistencyChecker} from "../consistency/lib/clients/IncConsistencyChecker"
import {IncClient} from "./IncClient"
import {isProposeNoError, isAcceptUnknownError, isConcurrentNoError, getErrorChecker} from "../consistency/lib/clients/exceptions"

const isVersionConflict = getErrorChecker("NO", ["ERRNO011", "ERRNO005"])

const CLIENT_CMD = /^clients: +([a-z0-9]+ *( *, *[a-z0-9]+ *)*)$/;
const NAME = /[a-z0-9]+/g;
const USE_CMD = /^make +([a-z0-9]+ *(?: *, *[a-z0-9]+ *)*) +use +([a-z0-9]+ *(?: *, *[a-z0-9]+ *)*)$/;
const START_CMD = /^start +([a-z0-9]+ *(?: *, *[a-z0-9]+ *)*)$/;
const STOP_CMD = /^stop +([a-z0-9]+ *(?: *, *[a-z0-9]+ *)*)$/;

class Timer {
    yield() {
        return new Promise((reply, reject) => {
            setTimeout(() => reply(null), 0);
        })
    }
}

class Dashboard {
    constructor(cluster, seed) {
        this.tui = new TUI();
        this.cluster = cluster;
        this.exit = x => {};
        this.isExited = false;
        this.isStarted = false;
        this.thread = null;
        this.checker = new IncConsistencyChecker();
        this.ctx = {
            timer: new Timer(),
            random: new Random(seedrandom(seed))
        };
    }
    onInput(handler) {
        this.tui.onInput(handler);
    }
    startClient(name) {
        const meta = this.cluster.clients.get(name);
        if (!meta.isStarted) {
            meta.isStarted = true;
            const proposerUrls = meta.proposers.map(p => this.cluster.proposers.get(p).url);
            meta.thread = IncClient.spawn({
                ctx: this.ctx, proposerUrls: proposerUrls, keys: ["key1", "key2"], 
                consistencyChecker: this.checker, recoverableErrors: [isProposeNoError, isAcceptUnknownError, isConcurrentNoError, isVersionConflict]
            });
            meta.info = this.tui.addclient({title: name, isactive: true, tries: 0, writes: 0});
            meta.thread.onIteration(x => {
                meta.info.updateState(x.stat.tries, x.stat.writes);
            });
        }
    }
    stopClient(name) {
        const meta = this.cluster.clients.get(name);
        if (meta.isStarted && !meta.isFinished) {
            meta.isFinished = true;
            meta.thread.stop();
        }
    }
    async start() {
        try {
            await new Promise((reply, reject) => {
                this.exit = x => {
                    if (!this.isExited) {
                        this.isExited = true;
                        reply(x);
                    }
                }
            });
            for (const key of this.cluster.clients.keys()) {
                const meta = this.cluster.clients.get(key);
                if (meta.isStarted && !meta.isFinished) {
                    meta.isFinished = true;
                    await meta.thread.stop();
                }
            }
        } catch(e) {
            console.info(e);
            throw e;
        } finally {
            this.tui.stop();
        }
    }
    stop() {
        (this.exit)();
    }
}


(async function() {
    
    const cluster = loadClusterInfo(process.argv[2]);
    const dashboard = new Dashboard(cluster, "seed42");
    
    try {
        dashboard.onInput(cmd => {
            execute(cmd, dashboard);
        });

        help(dashboard);

        await dashboard.start();
        
    } catch (e) {
        console.info("¯\\_(ツ)_/¯: SORRY")
        console.info(e);
        throw e;
    }
    
})();

function execute(cmd, dashboard) {
    if (cmd == "help") {
        help(dashboard);
    } else if (cmd == "quit") {
        dashboard.stop();
    } else if (cmd == "ls") {
        ls(dashboard);
    } else if (CLIENT_CMD.test(cmd)) {
        const matches = cmd.match(CLIENT_CMD);
        client(dashboard, matches[1].match(NAME))
    } else if (USE_CMD.test(cmd)) {
        const matches = cmd.match(USE_CMD);
        use(dashboard, matches[1].match(NAME), matches[2].match(NAME))
    } else if (START_CMD.test(cmd)) {
        const matches = cmd.match(START_CMD);
        start(dashboard, matches[1].match(NAME))
    } else if (STOP_CMD.test(cmd)) {
        const matches = cmd.match(STOP_CMD);
        stop(dashboard, matches[1].match(NAME))
    } else {
        dashboard.tui.log("Unknown command: \"" + cmd +"\"");
    }
}

function start(dashboard, clients) {
    for (const client of clients) {
        if (!dashboard.cluster.clients.has(client)) {
            dashboard.tui.log("Unknown client \"" + client + "\"");
            return;
        }
        if (dashboard.cluster.clients.get(client).isStarted) {
            dashboard.tui.log("Client \"" + client + "\" has been already started");
            return;
        }
        dashboard.startClient(client);
    }
}

function stop(dashboard, clients) {
    for (const client of clients) {
        if (!dashboard.cluster.clients.has(client)) {
            dashboard.tui.log("Unknown client \"" + client + "\"");
            return;
        }
        if (dashboard.cluster.clients.get(client).isFinished) {
            dashboard.tui.log("Client \"" + client + "\" is already stopped");
            return;
        }
        if (!dashboard.cluster.clients.get(client).isStarted) {
            dashboard.tui.log("Client \"" + client + "\" wasn't started");
            return;
        }
        dashboard.stopClient(client);
    }
}

function ls(dashboard) {
    const {tui, cluster} = dashboard;
    tui.log("Proposers:");
    for (const key of cluster.proposers.keys()) {
        const p = cluster.proposers.get(key);
        
        tui.log("  " + key + " = " + JSON.stringify({
            quorum: p.quorum,
            acceptors: p.acceptors,
            transient: p.transient,
            url: p.url
        }));
    }
    tui.log("");
    tui.log("Clients:");
    for (const key of cluster.clients.keys()) {
        const c = cluster.clients.get(key);
        
        tui.log("  " + key + " = " + JSON.stringify({
            proposers: c.proposers
        }));
    }
    tui.log("");
}

function client(dashboard, clients) {
    const {tui, cluster} = dashboard;
    for (const client of clients) {
        if (cluster.clients.has(client)) {
            tui.log("Client \"" + client + "\" already exists");
            return;
        }
    }

    for (const client of clients) {
        cluster.clients.set(client, {
            proposers: [],
            isFinished: false,
            isStarted: false,
            thread: null
        });
    }

    ls(dashboard);
}

function use(dashboard, clients, proposers) {
    const {tui, cluster} = dashboard;
    clients = new Set(clients);
    proposers = new Set(proposers);
    for (const client of clients) {
        if (!cluster.clients.has(client)) {
            tui.log("Unknown client \"" + client + "\"");
            return;
        }
        if (cluster.clients.get(client).isStarted) {
            tui.log("Can't edit active client \"" + client + "\"");
            return;
        }
    }
    for (const proposer of proposers) {
        if (!cluster.proposers.has(proposer)) {
            tui.log("Unknown proposer \"" + proposer + "\"");
            tui.log("");
            return;
        }
    }
    for (let client of clients) {
        client = cluster.clients.get(client);
        for (const proposer of proposers) {
            client.proposers.push(proposer)
        }
    }
    ls(dashboard);
}

function help(dashboard) {
    dashboard.tui.log("Commands:");
    dashboard.tui.log("  * \"help\" to see this message");
    dashboard.tui.log("  * \"quit\" to exit");
    dashboard.tui.log("  * \"ls\" to list proposers & clients");
    dashboard.tui.log("  * \"clients: name1, name2, name3\" to create any number of clients");
    dashboard.tui.log("  * \"make client1, client2 use proposer1, proposer2\" to make specified clients use specified proposers");
    dashboard.tui.log("  * \"start client1, client2\" to start specified clients");
    dashboard.tui.log("  * \"stop client1, client2\" to stop specified clients");
    dashboard.tui.log("");
}

function loadClusterInfo(path) {
    const settings = JSON.parse(fs.readFileSync(path));

    const cluster = {
        proposers: new Map(),
        clients: new Map()
    }

    for (const key of Object.keys(settings.proposers)) {
        const proposer = settings.proposers[key]
        cluster.proposers.set(key, {
            "quorum": [proposer.quorum.read, proposer.quorum.write],
            "acceptors": proposer.acceptors,
            "transient": proposer.transient,
            "url": "http://127.0.0.1:" + proposer.port + "/change"
        });
    }

    return cluster;
}