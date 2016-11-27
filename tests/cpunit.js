import {MessageFileLogger, MessageFileChecker} from "../src/tests/SimulationCore"

const CMDS = ["record", "replay"];
const TESTS = [
    "c2p2_onoff","c1p1_shuffling", "c1p1_loosing", "c1p1_partitioning", 
    "c1p2_shuffling", "c2p1_shuffling", "c2p2_shuffling", "c2p2_loosing", 
    "c2p2_partitioning_x", "c1p1_inconsistency"
];

if (process.argv.length != 5) {
    console.info(process.argv);
    help();
    process.exit(1);
}

runTests(process.argv[3], process.argv[2], process.argv[4])

async function runTests(testName, cmd, seed) {
    if (testName == "all") {
        for (const testName of TESTS) {
            await runTest(testName, cmd, seed)
        }
    } else {
        await runTest(testName, cmd, seed)
    }
}

async function runTest(testName, cmd, seed) {
    console.info(`# Running ${testName} (${cmd}) with ${seed} as a seed`);
    assertContains({element: cmd, set: CMDS});
    assertContains({element: testName, set: TESTS});
    const test = require(`./${testName}/test`).test;
    if (cmd=="record") {
        await test(seed, new MessageFileLogger(`./tests/${testName}/network.log`));
    } else if (cmd=="replay") {
        await test(seed, new MessageFileChecker(`./tests/${testName}/network.log`));
    }
}

function assertContains({element, set} = {}) {
    if (set.indexOf(element)==-1) {
        console.info("Got \"" + element + "\". Expected: " + set);
        console.info();
        help();
        process.exit(1);
    }
}

function help() {
    console.info("  node.js cpunit.js [record|replay] test seed");
    console.info();
    console.info("  Supported tests:");
    for (const test of TESTS) {
        console.info(`   * ${test}`);
    }
    console.info();
    console.info("  See tests folder for logs");
    console.info();
    console.info("  node.js cpunit.js [record|replay] all seed");
}