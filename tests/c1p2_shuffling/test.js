import {AcceptorMock, AcceptorClientMock, EonDb} from "../../src/tests/AcceptorMocks"
import {Bus, TheLoop, ShufflingBus, MessageFileLogger, MessageFileChecker} from "../../src/tests/SimulationCore"
import seedrandom from "seedrandom"

import buildProposer from  "../../src/tests/buildProposer"
import unwrapOk from  "../../src/tests/unwrapOk"
import ReadIncWriteConsistencyChecker from "../../src/tests/ReadIncWriteConsistencyChecker"
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

        this.key = "foo1";

        this.proposer1 = createProposer(this.loop, this.bus, "p1", quorum);
        this.proposer2 = createProposer(this.loop, this.bus, "p2", quorum);
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
        const start = hrtime();
        const loops = 200;
        try {
            const checker = new ReadIncWriteConsistencyChecker();

            let proposer = oneOf(this.random, [this.proposer1, this.proposer2]);
            
            const init = unwrapOk(await proposer.changeQuery(this.key, initChange(0), idQuery));
            checker.inited(this.key, init.version, init.value);

            for(let i=0;i<loops;i++) {

                await retryOnErrors(async () => {
                    proposer = oneOf(this.random, [this.proposer1, this.proposer2])
                    const read = unwrapOk(await proposer.changeQuery(this.key, idChange, idQuery));
                    checker.seen(this.key, read.version, read.value);
                    checker.writing(this.key, read.version, read.value + 1);
                    const write = unwrapOk(await proposer.changeQuery(this.key, updateChange({
                        version: read.version,
                        value: read.value + 1
                    }), idQuery));
                    checker.written(this.key, read.version, read.value + 1);
                }, [isLeadershipUnknownError, isLeadershipNoError]);
            }
            console.info("DONE");
            console.info(loops + " in " + JSON.stringify(hrtime(start)));
        } catch(e) {
            console.info("ERROR");
            console.info(e);
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

async function retryOnErrors(action, errors) {
    while (true) {
        try {
            return await action();
        } catch(e) {
            if (errors.some(isError => isError(e))) {
                continue;
            }
            throw e;
        }
    }
}

function isLeadershipUnknownError(e) {
    if (!e) return false;
    if (e.status!="UNKNOWN") return false;
    if (!e.details) return false;
    if (e.details.length!=3) return false;
    for (const id of ["ERRNO009","ERRNO007","ERRNO004"]) {
        if (!e.details.some(x => x.id==id)) return false;
    }
    return true;
}

function isLeadershipNoError(e) {
    if (!e) return false;
    if (e.status!="NO") return false;
    if (!e.details) return false;
    if (e.details.length!=4) return false;
    for (const id of ["ERRNO009","ERRNO007","ERRNO006","ERRNO003"]) {
        if (!e.details.some(x => x.id==id)) return false;
    }
    return true;
}