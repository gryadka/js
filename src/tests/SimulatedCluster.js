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
    constructor(proposerId, quorum, acceptorProxies) {
        this.proposerId = proposerId;
        this.quorum = quorum;
        this.acceptorProxies = acceptorProxies;
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
        await this.process;
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
            addProposer: (proposerId, quorum, acceptorProxies) => {
                const proposer = new ProposerController(proposerId, quorum, acceptorProxies);
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
            const proposer = createProposer(this.loop, this.bus, proposerProxy);
            this.proposers.push(proposer);
        }
        for (const thread of this.runnables) {
            thread.start();
        }
        this.loop.run();
    }
}

function createProposer(loop, bus, proposerProxy) {
    const id = proposerProxy.proposerId;
    const eonDb = new EonDb(id + "eondb", bus, 1);
    loop.addAgent(eonDb);
    
    const acs = [];
    for (const acceptorProxy of proposerProxy.acceptorProxies) {
        acs.push(new AcceptorClientMock(id + ":" + acceptorProxy.acceptorId, bus, acceptorProxy.acceptorId, false, loop.timer, 100));
    }
    acs.forEach(ac => loop.addAgent(ac));
    return buildProposer(id, eonDb, acs, proposerProxy.quorum);
}