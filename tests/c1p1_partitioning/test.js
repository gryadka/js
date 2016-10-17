import {ShufflingBus, FilteringBus} from "../../src/tests/SimulationCore"
import {SimulatedCluster} from "../../src/tests/SimulatedCluster"
import {InitInLoopIncKeysClient, waitAllClientsAsync, ClusterDriver, curry} from "../../src/tests/InitInLoopIncKeysClient"

export function test(seed, logger) {
    let isPartitioned = false;
    const keys = ["key1"];
    
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
    system.transformBus((bus, timer, random) => new FilteringBus(bus, message => {
        if (isPartitioned) {
            if (message.sender == "p1:a1") {
                return false;
            }
        }
        return true;
    }));
    const shared = InitInLoopIncKeysClient.createSharedMemory();

    const onStep = ClusterDriver({cluster: system, shared: shared, timeVariance: 10}).checkOneAfterAnother([
        [() => shared.didAllClientsMakeAtLeastIterations(30), () => (isPartitioned = true)],
        [() => shared.didAllClientsMakeAtLeastIterations(170), () => (isPartitioned = false)],
        [() => shared.didAllClientsMakeAtLeastIterations(200), () => {}]
    ]);

    const client = curry(InitInLoopIncKeysClient.asRunnable)({
        cluster: system, keys: keys, onStep: onStep, shared: shared,
        recoverableErrors: []
    })
    
    const c1 = system.spawnOnStart(client({clientId: "c1"}));
    waitAllClientsAsync([c1]);
    system.start(logger);
}
