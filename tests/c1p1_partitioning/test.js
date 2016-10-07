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
        tx.addProposer("p1", quorum, [a1, a2, a3]);
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
    const onStep = () => {
        if (shared.status=="ACTIVE" && shared.didAllClientsMakeAtLeastIterations(30)) {
            shared.status = "PARTITIONING";
            postpone(() => {
                shared.status = "PARTITIONED";
                isPartitioned = true;
            });
        }
        if (shared.status=="PARTITIONED" && shared.didAllClientsMakeAtLeastIterations(170)) {
            shared.status = "HEALING";
            postpone(() => {
                shared.status = "HEALED";
                isPartitioned = false;
            });
        }
        if (shared.status=="HEALED" && shared.didAllClientsMakeAtLeastIterations(200)) {
            shared.status = "EXITED";
        }
        function postpone(fn) {
            system.timer.postpone(system.timer.now() + 10 * system.random(), fn);
        }
    };

    const client = curry(InitInLoopIncKeysClient.asRunnable)({
        cluster: system, keys: keys, onStep: onStep, shared: shared,
        initExpectedErrors: [], 
        readUpdateExpectedErrors: []
    })
    
    const c1 = system.spawnOnStart(client({clientId: "c1"}));
    waitAllClientsAsync([c1]);
    system.start(logger);
}
