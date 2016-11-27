import {ShufflingBus} from "../../src/tests/SimulationCore"
import {isLeadershipNoError, isLeadershipUnknownError} from "../../src/tests/exceptions"
import {SimulatedCluster} from "../../src/tests/SimulatedCluster"
import {InitInLoopIncKeysClient, waitAllClientsAsync, ClusterDriver, curry} from "../../src/tests/InitInLoopIncKeysClient"

export async function test(seed, logger) {
    const keys = ["key1", "key2"];
    
    const system = new SimulatedCluster(seed);
    system.initTopology(tx => {
        const quorum = {
            "read": 2,
            "write": 2
        };
        var [a1, a2, a3] = ["a1", "a2", "a3"].map(id => tx.addAcceptor(id));
        tx.addProposer("p1", quorum, [a1, a2, a3], true, 100, false);
    });
    system.transformBus((bus, timer, random) => new ShufflingBus(bus, timer, random));
    const shared = InitInLoopIncKeysClient.createSharedMemory();
    const onStep = ClusterDriver({cluster: system, shared: shared, timeVariance: 10}).exitOnAllClientsIteratedAtLeast(200);

    const client = curry(InitInLoopIncKeysClient.asRunnable)({
        cluster: system, keys: keys, onStep: onStep, shared: shared,
        recoverableErrors: []
    })
    
    const c1 = system.spawnOnStart(client({clientId: "c1"}));
    const exit = waitAllClientsAsync([c1]);
    system.start(logger);
    await exit;
}
