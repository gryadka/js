import {AcceptorMock, AcceptorClientMock, EonDb} from "../../src/tests/AcceptorMocks"
import {Bus, TheLoop, ShufflingBus, MessageFileLogger, MessageFileChecker} from "../../src/tests/SimulationCore"

import buildProposer from  "../../src/tests/buildProposer"
import unwrapOk from  "../../src/tests/unwrapOk"
import ReadIncWriteConsistencyChecker from "../../src/tests/ReadIncWriteConsistencyChecker"
import {initChange, idChange, updateChange, idQuery} from  "../../src/tests/mutators"

class ShuffleTest {
    init(seed) {
        this.loop = new TheLoop();
        
        let bus = new Bus(this.loop);
        bus = new ShufflingBus(bus, this.loop.timer, seed);
        
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
            new AcceptorClientMock("a1c", this.bus, "a1s", false),
            new AcceptorClientMock("a2c", this.bus, "a2s", false),
            new AcceptorClientMock("a3c", this.bus, "a3s", false)
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

            const init = unwrapOk(await this.proposer.changeQuery(this.key, initChange(0), idQuery));
            checker.inited(this.key, init.version, init.value);

            for(let i=0;i<200;i++) {
                const read = unwrapOk(await this.proposer.changeQuery(this.key, idChange, idQuery));
                checker.seen(this.key, read.version, read.value);
                checker.writing(this.key, read.version, read.value + 1);
                const write = unwrapOk(await this.proposer.changeQuery(this.key, updateChange({
                    version: read.version,
                    value: read.value + 1
                }), idQuery));
                checker.written(this.key, read.version, read.value + 1);
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
