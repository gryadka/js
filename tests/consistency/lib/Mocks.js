const {AcceptorMock} = require("./Acceptor");
const {Cache} = require("../../../src/paxos/Cache");
const {Proposer} = require("../../../src/paxos/Proposer");

function createProposer({pidtime, pid, quorum={read:0, write:0}, acceptorClients=null}) {
    acceptorClients = createAcceptorClients(Object.assign({}, acceptorClients, { pid: pid }));
    
    const cache = new Cache(pidtime);
    const proposer = new Proposer(cache, acceptorClients, quorum);
    
    return proposer;
}

function createAcceptors(ctx, ids) {
    return ids.map(id => new AcceptorMock(ctx, id));
}

function createAcceptorClients({pid, network, acceptors, transient}) {
    return acceptors.map(x => x.createClient(pid, network, transient.has(x.id)));
}

exports.createAcceptorClients = createAcceptorClients;
exports.createAcceptors = createAcceptors;
exports.createProposer = createProposer;