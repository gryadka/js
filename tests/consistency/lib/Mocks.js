import {AcceptorMock} from "./Acceptor"
import Cache from "../../../src/paxos/Cache";
import Proposer from "../../../src/paxos/Proposer";

export function createProposer({pidtime, pid, quorum={read:0, write:0}, acceptorClients=null}) {
    acceptorClients = createAcceptorClients(Object.assign({}, acceptorClients, { pid: pid }));
    
    const cache = new Cache(pidtime);
    const proposer = new Proposer(cache, acceptorClients, quorum);
    
    return proposer;
}

export function createAcceptors(ctx, ids) {
    return ids.map(id => new AcceptorMock(ctx, id));
}

export function createAcceptorClients({pid, network, acceptors, transient}) {
    return acceptors.map(x => x.createClient(pid, network, transient.has(x.id)));
}