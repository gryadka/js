import {retryOnErrors} from "./exceptions"
import {initChange, idChange, updateChange, idQuery} from  "./mutators"
import unwrapOk from  "./unwrapOk"
import ConcurrencyConsistencyChecker from "./ConcurrencyConsistencyChecker"

export function curry(fn) {
    return (preset) => {
        return (args) => {
            var params = {};
            copyTo(preset, params);
            copyTo(args, params);
            return fn(params);
            function copyTo(src, dst) { 
                for (var property in src) {
                    if (src.hasOwnProperty(property)) {
                        dst[property] = src[property];
                    }
                }
            }
        }
    }
}

export function waitAllClientsAsync(clients) {
    (async () => {
        try {
            for (const client of clients) {
                await client.waitAsync();
            }
            console.info("DONE");
        } catch (e) {
            console.info("ERROR");
            console.info(e);
        }
    })();
}

export function ClusterDriver({cluster, shared, timeVariance}) {
    return {
        "exitOnAllClientsIteratedAtLeast": function(iterations) {
            return () => {
                if (shared.status=="ACTIVE" && shared.didAllClientsMakeAtLeastIterations(iterations)) {
                    shared.status = "EXITING";
                    cluster.timer.postpone(cluster.timer.now() + timeVariance * cluster.random(), () => {
                        shared.status = "EXITED";
                    });
                }
            }; 
        }
    }
}

export class InitInLoopIncKeysClient {
    static asRunnable({cluster, clientId, keys, onStep, shared, initExpectedErrors, readUpdateExpectedErrors}) {
        const client = new InitInLoopIncKeysClient(cluster, clientId, keys, shared);
        client.setInitExpectedErrors(initExpectedErrors);
        client.setReadUpdateExpectedErrors(readUpdateExpectedErrors);
        client.setOnUpdateHandler(onStep);
        return () => client.start();
    }

    static createSharedMemory() {
        return {
            status: "ACTIVE",
            clients: new Map(),
            checker: new ConcurrencyConsistencyChecker(),
            didAllClientsMakeAtLeastIterations: function(steps) {
                for (const clientId of this.clients.keys()) {
                    if (this.clients.get(clientId).steps < steps) {
                        return false;
                    }
                }
                return true;
            }
        }
    }

    constructor(cluster, clientId, keys, shared) {
        const {timer, random, proposers} = cluster;
        this.timer = timer;
        this.random = random;
        this.proposers = proposers;
        this.checker = shared.checker;
        this.clientId = clientId;
        this.keys = keys;
        this.shared = shared;
        this.shared.clients.set(this.clientId, { values: new Map(), steps: 0 });
        this.onStep = (client) => {};
        this.initExpectedErrors = [];
        this.readUpdateExpectedErrors = [];
    }
    setInitExpectedErrors(initExpectedErrors) {
        this.initExpectedErrors = initExpectedErrors;
    }
    setReadUpdateExpectedErrors(readUpdateExpectedErrors) {
        this.readUpdateExpectedErrors = readUpdateExpectedErrors;
    }
    setOnUpdateHandler(onUpdateHandler) {
        this.onStep = onUpdateHandler;
    }
    async start() {
        const mymem = this.shared.clients.get(this.clientId);
        
        let toInit = this.keys.slice(0); // making a copy

        await retryOnErrors(this.timer, async () => {
            while (toInit.length>0) {
                const proposer = oneOf(this.random, this.proposers);
                const [key, tail] = randomPop(this.random, toInit);
                const init = unwrapOk(await proposer.changeQuery(key, initChange(0), idQuery, this.clientId));
                mymem.values.set(key, {version: init.version, value: init.value});
                this.checker.inited(this.clientId, key, init.version, init.value);
                toInit = tail;
            }
        }, this.initExpectedErrors);

        mymem.steps = 0;
        while (this.shared.status != "EXITED") {
            (this.onStep)(this);
            await retryOnErrors(this.timer, async () => {
                const proposer = oneOf(this.random, this.proposers);
                const key = oneOf(this.random, this.keys);
                this.checker.sync(this.clientId);
                const read = unwrapOk(await proposer.changeQuery(key, idChange, idQuery));
                mymem.values.set(key, {version: read.version, value: read.value});
                this.checker.seen(this.clientId, key, read.version, read.value);
                this.checker.writing(this.clientId, key, read.version, read.value + 1);
                const write = unwrapOk(await proposer.changeQuery(key, updateChange({
                    version: read.version,
                    value: read.value + 1
                }), idQuery));
                this.checker.written(this.clientId, key, write.version, write.value);
                mymem.values.set(key, {version: write.version, value: write.value});
            }, this.readUpdateExpectedErrors);
            mymem.steps++;
        }
    }
}

function oneOf(random, array) {
    return array[Math.floor(random() * array.length)];
}

function randomPop(random, array) {
    array = array.slice(0);
    const i = Math.floor(random() * array.length);
    var element = array[i];
    array[i] = array[array.length-1];
    array.pop();
    return [element, array];
}