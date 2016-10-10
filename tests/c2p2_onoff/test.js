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
        p1 = tx.addProposer("p1", quorum, [a1, a2, a3], true);
        p2 = tx.addProposer("p2", quorum, [a1, a2, a3], true);
    });
    system.transformBus((bus, timer, random) => new ShufflingBus(bus, timer, random));
    const shared = InitInLoopIncKeysClient.createSharedMemory();

    const onStep = () => {
        if (shared.status=="ACTIVE" && shared.didAllClientsMakeAtLeastIterations(30)) {
            shared.status = "TURNING OFF P1";
            postpone(() => {
                shared.status = "P1_OFF";
                p1.turnOff();
            });
        }
        if (shared.status=="P1_OFF" && shared.didAllClientsMakeAtLeastIterations(170)) {
            shared.status = "TURNING ON P1";
            postpone(() => {
                shared.status = "P1_ON";
                p1.turnOn();
            });
        }
        if (shared.status=="P1_ON" && shared.didAllClientsMakeAtLeastIterations(200)) {
            shared.status = "EXITED";
        }
        function postpone(fn) {
            system.timer.postpone(system.timer.now() + 10 * system.random(), fn);
        }
    };


//    const onStep = ClusterDriver({cluster: system, shared: shared, timeVariance: 10}).exitOnAllClientsIteratedAtLeast(200);
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