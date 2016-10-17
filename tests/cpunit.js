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

assertContains({element: process.argv[2], set: CMDS});
assertContains({element: process.argv[3], set: TESTS});

const test = require(`./${process.argv[3]}/test`).test;

if (process.argv[2]=="record") {
    test(process.argv[4], new MessageFileLogger(`./tests/${process.argv[3]}/network.log`));
}

if (process.argv[2]=="replay") {
    test(process.argv[4], new MessageFileChecker(`./tests/${process.argv[3]}/network.log`));
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
}