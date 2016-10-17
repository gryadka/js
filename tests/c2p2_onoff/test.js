import {ShufflingBus, FilteringBus} from "../../src/tests/SimulationCore"
import {isConcurrentNoError, isProposeNoError, isAcceptUnknownError, isLeadershipNoError, isLeadershipUnknownError} from "../../src/tests/exceptions"
import {SimulatedCluster} from "../../src/tests/SimulatedCluster"
import {InitInLoopIncKeysClient, waitAllClientsAsync, ClusterDriver, curry} from "../../src/tests/InitInLoopIncKeysClient"

export function test(seed, logger) {
    const keys = ["key1", "key2"];
    
    const system = new SimulatedCluster(seed);
    let p1, p2;
    system.initTopology(tx => {
        const quorum = {
            "read": 2,
            "write": 2
        };
        var [a1, a2, a3] = ["a1", "a2", "a3"].map(id => tx.addAcceptor(id));
        p1 = tx.addProposer("p1", quorum, [a1, a2, a3], true, 100, false);
        p2 = tx.addProposer("p2", quorum, [a1, a2, a3], true, 100, false);
    });
    system.transformBus((bus, timer, random) => new ShufflingBus(bus, timer, random));
    const shared = InitInLoopIncKeysClient.createSharedMemory();

    const onStep = ClusterDriver({cluster: system, shared: shared, timeVariance: 10}).checkOneAfterAnother([
        [() => shared.didAllClientsMakeAtLeastIterations(30), () => p1.turnOff()],
        [() => shared.didAllClientsMakeAtLeastIterations(170), () => p1.turnOn()],
        [() => shared.didAllClientsMakeAtLeastIterations(200), () => {}]
    ]);

    const client = curry(InitInLoopIncKeysClient.asRunnable)({
        cluster: system, keys: keys, onStep: onStep, shared: shared,
        recoverableErrors: [isConcurrentNoError, isLeadershipNoError, isLeadershipUnknownError, isAcceptUnknownError, isProposeNoError]
    })
    
    const c1 = system.spawnOnStart(client({clientId: "c1"}));
    const c2 = system.spawnOnStart(client({clientId: "c2"}));
    waitAllClientsAsync([c1, c2]);
    system.start(logger);
}