const {Proposer, ProposerError, BallotNumber} = require("gryadka-core");
const {AcceptorClient} = require("gryadka-redis");

module.exports = function (config) {
    const acceptors = new Map();
    for (let node of [...config.prepare.nodes, ...config.accept.nodes]) {
        const endpoint = `${node.host}:${node.port}`;
        if (acceptors.has(endpoint)) continue;
        acceptors.set(endpoint, new AcceptorClient(node.host, node.port, x=>BallotNumber.parse(x)));
    }
    const prepare = config.prepare.nodes.map(x => acceptors.get(`${x.host}:${x.port}`));
    const accept = config.accept.nodes.map(x => acceptors.get(`${x.host}:${x.port}`));
    
    return new Proposer(
        new BallotNumber(0, `${config.proposerId}/${config.configVersion}`),
        {
            nodes: prepare,
            quorum: config.prepare.quorum
        },
        {
            nodes: accept,
            quorum: config.accept.quorum
        }
    );
};