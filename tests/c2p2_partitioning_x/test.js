import {AcceptorMock, AcceptorClientMock, EonDb} from "../../src/tests/AcceptorMocks"
import {Bus, TheLoop, ShufflingBus, FilteringBus, MessageFileLogger, MessageFileChecker} from "../../src/tests/SimulationCore"
import {retryOnErrors, isConcurrentNoError, isProposeNoError, isAcceptUnknownError, isLeadershipNoError, isLeadershipUnknownError} from "../../src/tests/exceptions"
import seedrandom from "seedrandom"

import buildProposer from  "../../src/tests/buildProposer"
import unwrapOk from  "../../src/tests/unwrapOk"
import ConcurrencyConsistencyChecker from "../../src/tests/ConcurrencyConsistencyChecker"
import {initChange, idChange, updateChange, idQuery} from  "../../src/tests/mutators"

import {hrtime} from "process"

class ShuffleTest {
    init(seed) {
        this.loop = new TheLoop();
        
        let bus = new Bus(this.loop);
        this.random = seedrandom(seed);
        bus = new ShufflingBus(bus, this.loop.timer, this.random);
        // loosing a message everytime when .9 < random() 
        bus = new FilteringBus(bus, message => {
            if (this.isPartitioned) {
                if (message.recipient == "a1s" && message.sender == "p1a1c") {
                    return false;
                }
                if (message.recipient == "a3s" && message.sender == "p2a3c") {
                    return false;
                }
            }
            return true;
        });
        
        this.isPartitioned = false;

        this.bus = bus;

        this.loop.addAgent(this);
        this.loop.addAgent(new AcceptorMock("a1s", this.bus));
        this.loop.addAgent(new AcceptorMock("a2s", this.bus));
        this.loop.addAgent(new AcceptorMock("a3s", this.bus));

        const quorum = {
            "read": 2,
            "write": 2
        };

        this.keys = ["foo1", "foo2"];

        this.proposer1 = createProposer(this.loop, this.bus, "p1", quorum);
        this.proposer2 = createProposer(this.loop, this.bus, "p2", quorum);
        this.proposers = [this.proposer1, this.proposer2];
    }

    setLogger(logger) {
        this.loop.setLogger(logger);
    }

    tick() {
        if (!this.stopTicking) {
            const checker = new ConcurrencyConsistencyChecker();
            this.stopTicking = true;

            (async () => {
                try {
                    const shared = {};
                    const c1 = this.runClient("c1", checker, shared);
                    const c2 = this.runClient("c2", checker, shared);
                    await c1;
                    await c2;
                    console.info("DONE");
                } catch (e) {
                    console.info("ERROR");
                    console.info(e);
                }
            })();

            return true;
        }
        return false;
    }

    run() {
        this.loop.run();
    }

    async runClient(clientId, checker, shared) {
        var keys = this.keys.slice(0);

        await retryOnErrors(this.loop.timer, async () => {
            while (keys.length>0) {
                const proposer = oneOf(this.random, this.proposers);
                const [key, tail] = randomPop(this.random, keys);
                const init = unwrapOk(await proposer.changeQuery(key, initChange(0, clientId), idQuery, clientId));
                checker.inited(clientId, key, init.version, init.value);
                keys = tail;
            }
        }, [isConcurrentNoError, isLeadershipNoError, isLeadershipUnknownError, isAcceptUnknownError, isProposeNoError]);
        
        if (!shared.hasOwnProperty("value")) {
            shared.value = 0;
            shared.status = "HEALED";
        }
        while(shared.value < 200) {

            if (shared.value>=30 && shared.status == "HEALED") {
                shared.status = "PARTITIONING";
                this.loop.timer.postpone( 
                    this.loop.timer.now() + 10 * this.random(),
                    () => {
                        shared.status = "PARTITIONED";
                        this.isPartitioned = true;
                    }
                );
            }
            
            if (shared.value>=150 && shared.status == "PARTITIONED") {
                shared.status = "HEALING";
                this.loop.timer.postpone(
                    this.loop.timer.now() + 10 * this.random(),
                    () => {
                        shared.status = "HEALED";
                        this.isPartitioned = false;
                    }
                );
            }



            await retryOnErrors(this.loop.timer, async () => {
                const proposer = oneOf(this.random, this.proposers);
                const key = oneOf(this.random, this.keys);
                checker.sync(clientId);
                const read = unwrapOk(await proposer.changeQuery(key, idChange, idQuery));
                shared.value = Math.max(read.value, shared.value);
                checker.seen(clientId, key, read.version, read.value);
                checker.writing(clientId, key, read.version, read.value + 1);
                const write = unwrapOk(await proposer.changeQuery(key, updateChange({
                    version: read.version,
                    value: read.value + 1
                }), idQuery));
                checker.written(clientId, key, write.version, write.value);
            }, [ isConcurrentNoError, isLeadershipNoError, isLeadershipUnknownError, isAcceptUnknownError, isProposeNoError ]);
        }
    }
}

function createProposer(loop, bus, id, quorum) {
    const eonDb = new EonDb(id + "eondb", bus, 1);
    loop.addAgent(eonDb);
    const acs = [
        new AcceptorClientMock(id + "a1c", bus, "a1s", false, loop.timer, 100),
        new AcceptorClientMock(id + "a2c", bus, "a2s", false, loop.timer, 100),
        new AcceptorClientMock(id + "a3c", bus, "a3s", false, loop.timer, 100)
    ];
    acs.forEach(ac => loop.addAgent(ac));
    return buildProposer(id, eonDb, acs, quorum);
}

export function record(seed, path) {
    const test =  new ShuffleTest();
    test.init(seed);
    test.setLogger(new MessageFileLogger(path));
    test.run();
}

export function replay(seed, path) {
    const test =  new ShuffleTest();
    test.init(seed);
    test.setLogger(new MessageFileChecker(path));
    test.run();
}


function oneOf(random, array) {
    return array[Math.floor(random() * array.length)];
}

function randomPop(random, array) {
    array = array.slice(0);
    const i = Math.floor(random() * array.length);
    var element = array[i];
    array[i] = array[array.length-1];
    array.pop();
    return [element, array];
}