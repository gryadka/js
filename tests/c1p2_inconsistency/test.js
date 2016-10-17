import {ShufflingBus, LoosingBus} from "../../src/tests/SimulationCore"
import {isConsistencyViolation, isLeadershipNoError, isLeadershipUnknownError, isAcceptUnknownError, isProposeNoError} from "../../src/tests/exceptions"
import {SimulatedCluster} from "../../src/tests/SimulatedCluster"
import {InitInLoopIncKeysClient, waitAllClientsAsync, ClusterDriver, curry} from "../../src/tests/InitInLoopIncKeysClient"

export function test(seed, logger) {
    const keys = ["key1"];
    
    const system = new SimulatedCluster(seed);
    system.initTopology(tx => {
        const quorum = {
            "read": 1,
            "write": 1
        };
        var [a1, a2, a3] = ["a1", "a2", "a3"].map(id => tx.addAcceptor(id));
        tx.addProposer("p1", quorum, [a1, a2, a3], true, 100, true);
    });
    system.transformBus((bus, timer, random) => new ShufflingBus(bus, timer, random, 10));
    system.transformBus((bus, timer, random) => new LoosingBus(bus, random, .9));
    const shared = InitInLoopIncKeysClient.createSharedMemory();
    const onStep = ClusterDriver({cluster: system, shared: shared, timeVariance: 10}).exitOnAllClientsIteratedAtLeast(200);

    const client = curry(InitInLoopIncKeysClient.asRunnable)({
        cluster: system, keys: keys, onStep: onStep, shared: shared,
        recoverableErrors: [isLeadershipUnknownError, isLeadershipNoError, isProposeNoError, isAcceptUnknownError],
        requiredError: isConsistencyViolation
    });
    
    const c1 = system.spawnOnStart(client({clientId: "c1"}));
    waitAllClientsAsync([c1]);
    system.start(logger);
}
