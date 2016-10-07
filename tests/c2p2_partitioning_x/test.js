import {ShufflingBus, FilteringBus} from "../../src/tests/SimulationCore"
import {isConcurrentNoError, isProposeNoError, isAcceptUnknownError, isLeadershipNoError, isLeadershipUnknownError} from "../../src/tests/exceptions"
import {SimulatedCluster} from "../../src/tests/SimulatedCluster"
import {InitInLoopIncKeysClient, waitAllClientsAsync, ClusterDriver, curry} from "../../src/tests/InitInLoopIncKeysClient"

export function test(seed, logger) {
    let isPartitioned = false;
    const keys = ["key1", "key2"];
    
    const system = new SimulatedCluster(seed);
    system.initTopology(tx => {
        const quorum = {
            "read": 2,
            "write": 2
        };
        var [a1, a2, a3] = ["a1", "a2", "a3"].map(id => tx.addAcceptor(id));
        tx.addProposer("p1", quorum, [a1, a2, a3]);
        tx.addProposer("p2", quorum, [a1, a2, a3]);
    });
    system.transformBus((bus, timer, random) => new ShufflingBus(bus, timer, random));
    system.transformBus((bus, timer, random) => new FilteringBus(bus, message => {
        if (isPartitioned) {
            if (message.recipient == "a1" && message.sender == "p1:a1") {
                return false;
            }
            if (message.recipient == "a3" && message.sender == "p2:a3") {
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
        initExpectedErrors: [isConcurrentNoError, isLeadershipNoError, isLeadershipUnknownError, isAcceptUnknownError, isProposeNoError], 
        readUpdateExpectedErrors: [isConcurrentNoError, isLeadershipNoError, isLeadershipUnknownError, isAcceptUnknownError, isProposeNoError]
    })
    
    const c1 = system.spawnOnStart(client({clientId: "c1"}));
    const c2 = system.spawnOnStart(client({clientId: "c2"}));
    waitAllClientsAsync([c1, c2]);
    system.start(logger);
}