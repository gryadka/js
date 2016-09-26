import {AcceptorMock, AcceptorClientMock, Bus} from "../../src/tests/AcceptorMocks"

import buildProposer from  "../../src/tests/buildProposer"
import {NetworkReceiver, listenBusAsync} from  "../../src/tests/NetworkReceiver"
import {NetworkLogger} from  "../../src/tests/NetworkLogger"
import {NetworkChecker} from  "../../src/tests/NetworkChecker"
import Shuffler from  "../../src/tests/Shuffler"
import unwrapOk from  "../../src/tests/unwrapOk"
import ReadIncWriteConsistencyChecker from "../../src/tests/ReadIncWriteConsistencyChecker"
import {initChange, idChange, updateChange, idQuery} from  "../../src/tests/mutators"

class ShuffleTest {
    init() {
        this.bus = new Bus();
        this.receiver = new NetworkReceiver();

        this.receiver.registerAcceptor("id1", new AcceptorMock());
        this.receiver.registerAcceptor("id2", new AcceptorMock());
        this.receiver.registerAcceptor("id3", new AcceptorMock());

        const quorum = {
            "read": 2,
            "write": 2
        };

        this.proposer = buildProposer(1, this.bus, 1, [
            new AcceptorClientMock("id1", false, this.bus),
            new AcceptorClientMock("id2", false, this.bus),
            new AcceptorClientMock("id3", false, this.bus)
        ], quorum);

        this.key = "foo1";
    }

    addShufflerTransformer(seed) {
        this.receiver = new Shuffler(this.receiver, seed, 3);
    }

    addNetworkLogger(name) {
        this.receiver = new NetworkLogger(this.receiver, name);
    }

    addNetworkChecker(name) {
        this.receiver = new NetworkChecker(this.receiver, name);
    }

    turnOnAcceptors() {
        listenBusAsync(this.bus, this.receiver);
    }

    async runClient() {
        try {
            const checker = new ReadIncWriteConsistencyChecker();

            this.receiver.on();
            
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

            this.receiver.off();

            console.info("DONE");
        } catch(e) {
            console.info("ERROR");
            console.info(e);
        }
    }
}


export function record(seed, name) {
    const test =  new ShuffleTest();
    test.init();
    test.addNetworkLogger(name);
    test.addShufflerTransformer(seed);
    test.turnOnAcceptors();
    test.runClient();
}

export function replay(seed, name) {
    const test =  new ShuffleTest();
    test.init();
    test.addNetworkChecker(name);
    test.addShufflerTransformer(seed);
    test.turnOnAcceptors();
    test.runClient();
}
