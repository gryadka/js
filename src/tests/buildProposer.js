import Cache from "../mvpaxos/Cache"; 
import {Time} from "../mvpaxos/Time";
import Proposer from "../mvpaxos/Proposer";

export default function buildProposer(id, eonDb, acceptors, quorum) {
    const cache = new Cache();
    const time = new Time(eonDb.read(), id, x => eonDb.updateEon(x));
    const proposer = new Proposer(id, cache, acceptors, time, quorum);
    proposer.id = id;
    proposer.eonDb = eonDb;
    return proposer;
}