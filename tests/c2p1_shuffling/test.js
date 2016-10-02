import {AcceptorMock, AcceptorClientMock, EonDb} from "../../src/tests/AcceptorMocks"
import {Bus, TheLoop, ShufflingBus, LoosingBus, MessageFileLogger, MessageFileChecker} from "../../src/tests/SimulationCore"

import {retryOnErrors, retryOnErrors2, isConcurrentNoError} from "../../src/tests/exceptions"
import seedrandom from "seedrandom"

import buildProposer from  "../../src/tests/buildProposer"
import unwrapOk from  "../../src/tests/unwrapOk"
import ConcurrencyConsistencyChecker from "../../src/tests/ConcurrencyConsistencyChecker"
import ReadIncWriteConsistencyChecker from "../../src/tests/ReadIncWriteConsistencyChecker"
import {initChange, idChange, updateChange, idQuery} from  "../../src/tests/mutators"

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

        const eonDb = new EonDb("eondb1", this.bus, 1);

        this.loop.addAgent(eonDb);

        const acs = [
            new AcceptorClientMock("a1c", this.bus, "a1s", false, this.loop.timer, 100),
            new AcceptorClientMock("a2c", this.bus, "a2s", false, this.loop.timer, 100),
            new AcceptorClientMock("a3c", this.bus, "a3s", false, this.loop.timer, 100)
        ];

        acs.forEach(ac => this.loop.addAgent(ac));

        this.proposer = buildProposer(1, eonDb, acs, quorum);

        this.keys = ["foo1", "foo2"];
    }

    setLogger(logger) {
        this.loop.setLogger(logger);
        this.logger = logger;
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
                    const [key, tail] = randomPop(this.random, keys);
                    const init = unwrapOk(await this.proposer.changeQuery(key, initChange(0, clientId), idQuery, clientId));
                    checker.inited(clientId, key, init.version, init.value);
                    keys = tail;
                }
            }, [isConcurrentNoError]);
            
            let value = 0
            while(value < 200) {
                await retryOnErrors(this.loop.timer, async () => {
                    const key = oneOf(this.random, this.keys);
                    checker.sync(clientId);
                    const read = unwrapOk(await this.proposer.changeQuery(key, idChange, idQuery));
                    value = Math.max(read.value, value);
                    checker.seen(clientId, key, read.version, read.value);
                    checker.writing(clientId, key, read.version, read.value + 1);
                    const write = unwrapOk(await this.proposer.changeQuery(key, updateChange({
                        version: read.version,
                        value: read.value + 1
                    }), idQuery));
                    checker.written(clientId, key, write.version, write.value);
                }, [ isConcurrentNoError ]);
            }
    }
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