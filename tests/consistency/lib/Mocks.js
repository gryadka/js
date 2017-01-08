import {AcceptorMock} from "./Acceptor"
import Cache from "../../../src/paxos/Cache";
import {Time} from "../../../src/paxos/Time";
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

export function createAcceptorClients({pid, network, acceptors, beingIntroduced}) {
    return acceptors.map(x => x.createClient(pid, network, beingIntroduced.has(x.id)));
}