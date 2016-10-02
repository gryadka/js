import {AcceptorMock, AcceptorClientMock, EonDb} from "../../src/tests/AcceptorMocks"
import {Bus, TheLoop, ShufflingBus, LoosingBus, MessageFileLogger, MessageFileChecker} from "../../src/tests/SimulationCore"
import {retryOnErrors, isProposeNoError, isAcceptUnknownError} from "../../src/tests/SimulationCore"
import seedrandom from "seedrandom"

import buildProposer from  "../../src/tests/buildProposer"
import unwrapOk from  "../../src/tests/unwrapOk"
import ReadIncWriteConsistencyChecker from "../../src/tests/ReadIncWriteConsistencyChecker"
import {initChange, idChange, updateChange, idQuery} from  "../../src/tests/mutators"

class ShuffleTest {
    init(seed) {
        this.loop = new TheLoop();
        
        let bus = new Bus(this.loop);
        const random = seedrandom(seed);
        bus = new ShufflingBus(bus, this.loop.timer, random);
        // loosing a message everytime when .9 < random() 
        bus = new LoosingBus(bus, random, .9);
        
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

        this.key = "foo1";
    }

    setLogger(logger) {
        this.loop.setLogger(logger);
    }

    tick() {
        if (!this.stopTicking) {
            this.runClient();
            this.stopTicking = true;
            return true;
        }
        return false;
    }

    run() {
        this.loop.run();
    }

    async runClient() {
        try {
            const checker = new ReadIncWriteConsistencyChecker();
            const init = await retryOnErrors(this.loop.timer, async () => {
                return unwrapOk(await this.proposer.changeQuery(this.key, initChange(0), idQuery))
            }, [isProposeNoError, isAcceptUnknownError]);
            checker.inited(this.key, init.version, init.value);

            for(let i=0;i<200;i++) {
                await retryOnErrors(this.loop.timer, async () => {
                    const read = unwrapOk(await this.proposer.changeQuery(this.key, idChange, idQuery));
                    checker.seen(this.key, read.version, read.value);
                    checker.writing(this.key, read.version, read.value + 1);
                    const write = unwrapOk(await this.proposer.changeQuery(this.key, updateChange({
                        version: read.version,
                        value: read.value + 1
                    }), idQuery));
                    checker.written(this.key, read.version, read.value + 1);
                }, [isAcceptUnknownError]);
            }

            console.info("DONE");
        } catch(e) {
            console.info("ERROR");
            console.info(e);
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
