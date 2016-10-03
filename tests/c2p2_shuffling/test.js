import {AcceptorMock, AcceptorClientMock, EonDb} from "../../src/tests/AcceptorMocks"
import {Bus, TheLoop, ShufflingBus, MessageFileLogger, MessageFileChecker} from "../../src/tests/SimulationCore"
import {retryOnErrors, isConcurrentNoError, isLeadershipNoError, isLeadershipUnknownError} from "../../src/tests/exceptions"
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
                    const c1 = this.runClient("c1", checker);
                    const c2 = this.runClient("c2", checker);
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

    async runClient(clientId, checker) {
        var keys = this.keys.slice(0);

        await retryOnErrors(this.loop.timer, async () => {
            while (keys.length>0) {
                const proposer = oneOf(this.random, this.proposers);
                const [key, tail] = randomPop(this.random, keys);
                const init = unwrapOk(await proposer.changeQuery(key, initChange(0, clientId), idQuery, clientId));
                checker.inited(clientId, key, init.version, init.value);
                keys = tail;
            }
        }, [isConcurrentNoError, isLeadershipNoError, isLeadershipUnknownError]);
        
        let value = 0
        while(value < 200) {
            await retryOnErrors(this.loop.timer, async () => {
                const proposer = oneOf(this.random, this.proposers);
                const key = oneOf(this.random, this.keys);
                checker.sync(clientId);
                const read = unwrapOk(await proposer.changeQuery(key, idChange, idQuery));
                value = Math.max(read.value, value);
                checker.seen(clientId, key, read.version, read.value);
                checker.writing(clientId, key, read.version, read.value + 1);
                const write = unwrapOk(await proposer.changeQuery(key, updateChange({
                    version: read.version,
                    value: read.value + 1
                }), idQuery));
                checker.written(clientId, key, write.version, write.value);
            }, [ isConcurrentNoError, isLeadershipNoError, isLeadershipUnknownError ]);
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