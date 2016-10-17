import {Bus, TheLoop} from "./SimulationCore"
import {AcceptorMock, AcceptorClientMock, EonDb} from "./AcceptorMocks"
import seedrandom from "seedrandom"
import buildProposer from  "./buildProposer"

class AcceptorController {
    constructor(acceptorId) {
        this.acceptorId = acceptorId;
    }
}

class ProposerController {
    constructor(proposerId, quorum, acceptorProxies, isAlive, timeout, isLeaderless) {
        this.proposerId = proposerId;
        this.quorum = quorum;
        this.acceptorProxies = acceptorProxies;
        this.isAttached = false;
        this.proposer = null;
        this.acceptorClients = [];
        this.isAlive = isAlive;
        this.timeout = timeout;
        this.isLeaderless = isLeaderless;
    }
    turnOn() {
        if (!this.isAttached) throw new Error("ProposerController should be attached to the Proposer");
        for (const client of this.acceptorClients) {
            client.turnOn();
        }
    }
    turnOff() {
        if (!this.isAttached) throw new Error("ProposerController should be attached to the Proposer");
        for (const client of this.acceptorClients) {
            client.turnOff();
        }
    }
    attach(proposer, acceptorClients) {
        if (this.isAttached) throw new Error("You can call attach only once.");
        this.proposer = proposer;
        this.acceptorClients = acceptorClients;
        this.isAttached = true;
    }
}

class ThreadController {
    constructor(runnableAsync) {
        this.isInited = false;
        this.runnableAsync = runnableAsync;
        this.process = null;
        this.initing = new Promise((resolve, reject) => {
            this.inited = resolve;
        }) 
    }
    start() {
        if (this.isInited) throw new Error("Invalid state");
        this.process = (this.runnableAsync)();
        this.isInited = true;
        (this.inited)(null);
    }
    async waitAsync() {
        await this.initing;
        await (this.process);
    }
}

export class SimulatedCluster {
    constructor(seed) {
        this.loop = new TheLoop();
        this.bus = new Bus(this.loop);
        this.random = seedrandom(seed);
        this.isInited = false;
        this.proposers = [];
        this.runnables = [];
        this.acceptorProxies = [];
        this.proposerProxies = [];
    }
    get timer() {
        return this.loop.timer;
    }
    transformBus(tranformation) {
        this.bus = tranformation(this.bus, this.loop.timer, this.random);
    }
    initTopology(txBuilder) {
        if (this.isInited) {
            throw new Error("initTopology should be called only once");
        }
        this.isInited = true;
        txBuilder({
            addAcceptor: acceptorId => {
                const acceptor = new AcceptorController(acceptorId);
                this.acceptorProxies.push(acceptor);
                return acceptor;
            },
            addProposer: (proposerId, quorum, acceptorProxies, isAlive, timeout, isLeaderless) => {
                if (!timeout) {
                    timeout = 100;
                }
                const proposer = new ProposerController(proposerId, quorum, acceptorProxies, isAlive, timeout, isLeaderless);
                this.proposerProxies.push(proposer)
                return proposer;
            }
        });
    }
    spawnOnStart(runnableAsync) {
        const thread = new ThreadController(runnableAsync);
        this.runnables.push(thread);
        return thread;
    }
    start(logger=null) {
        if (logger != null) {
            this.loop.setLogger(logger);
        }
        for (const acceptorProxy of this.acceptorProxies) {
            const acceptor = new AcceptorMock(acceptorProxy.acceptorId, this.bus);
            this.loop.addAgent(acceptor);
        }
        for (const proposerProxy of this.proposerProxies) {
            const proposer = createProposer(this.loop, this.bus, proposerProxy, proposerProxy.timeout, proposerProxy.isLeaderless);
            this.proposers.push(proposer);
        }
        for (const thread of this.runnables) {
            thread.start();
        }
        this.loop.run();
    }
}

function createProposer(loop, bus, proposerProxy, timeout, isLeaderless) {
    const id = proposerProxy.proposerId;
    const eonDb = new EonDb(id + "eondb", bus, 1);
    loop.addAgent(eonDb);
    
    const acs = [];
    for (const acceptorProxy of proposerProxy.acceptorProxies) {
        acs.push(new AcceptorClientMock(
            id + ":" + acceptorProxy.acceptorId, bus, 
            acceptorProxy.acceptorId, false, loop.timer, timeout, proposerProxy.isAlive
        ));
    }
    acs.forEach(ac => loop.addAgent(ac));
    const proposer = buildProposer(id, eonDb, acs, proposerProxy.quorum, isLeaderless);
    proposerProxy.attach(proposer, acs);
    return proposer;
}