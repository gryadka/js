import {EonDb} from "./AcceptorMocks";
import Cache from "../mvpaxos/Cache"; 
import {Time} from "../mvpaxos/Time";
import Proposer from "../mvpaxos/Proposer";

export default function buildProposer(id, bus, eon, acceptors, quorum) {
    const eonDb = new EonDb(eon, bus);
    const cache = new Cache();
    const time = new Time(eonDb.read(), id, x => eonDb.updateEon(x));
    const proposer = new Proposer(id, cache, acceptors, time, quorum);
    proposer.id = id;
    proposer.eonDb = eonDb;
    return proposer;
}