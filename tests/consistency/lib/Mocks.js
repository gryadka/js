const {AcceptorMock} = require("./Acceptor");
const {Cache} = require("../../../src/Cache");
const {ProposerAdapter} = require("./ProposerAdapter");

function createProposer({pidtime, pid, network, prepare, accept}) {
    const cache = new Cache(pidtime);

    prepare = {
        nodes: prepare.nodes.map(x => x.createClient(pid, network)),
        quorum: prepare.quorum
    };
    accept = {
        nodes: accept.nodes.map(x => x.createClient(pid, network)),
        quorum: accept.quorum
    };

    const proposer = new ProposerAdapter(cache, prepare, accept);
    
    return proposer;
}

function createAcceptors(ctx, ids) {
    return ids.map(aid => new AcceptorMock(ctx, aid));
}

exports.createAcceptors = createAcceptors;
exports.createProposer = createProposer;