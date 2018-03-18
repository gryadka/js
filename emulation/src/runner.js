const {LogWriter} = require("./lib/logging/LogWriter");
const {LogChecker} = require("./lib/logging/LogChecker");
const {LimitedVoid} = require("./lib/logging/LimitedVoid");
const {Void} = require("./lib/logging/Void");

const CMDS = ["record", "replay", "reduce", "void"];
const TESTS = [
    "losing/c6p2k2", "losing/c1p1k1", "shuffling/c1p1k1", "shuffling/c1p2k2", "partitioning/c1p1k1",
    "shuffling/c2p1k2", "shuffling/c2p2k1", "losing/c2p2k2", "partitioning/c2p2k2",
    "membership/c2p2k2.a3.a4", "membership/c2p2k2.flux"
];

if (process.argv.length < 5) {
    console.info(process.argv);
    help();
    process.exit(1);
}

const cmd  = assertContains({element: process.argv[3], set: CMDS});

const intensity = process.argv.length == 6 && process.argv[5].match(/^\d+$/) ? parseInt(process.argv[5]) : null;

(async () => await ({
    "record": record,
    "replay": replay,
    "reduce": reduce,
    "void": hole
})[cmd](process.argv[2], process.argv[4], intensity))()

async function hole(testselector, seed, intensity) {
    try {
        await execute(testselector, test => new Void(), seed, intensity);
    } catch(e) {
        console.info(e);
        throw e;
    }
}

async function record(testselector, seed, intensity) {
    try {
        await execute(testselector, test => new LogWriter(`./tests/scenarios/${test}.log`), seed, intensity);
    } catch(e) {
        console.info(e);
        throw e;
    }
}

async function replay(testselector, seed, intensity) {
    await execute(testselector, test => new LogChecker(`./tests/scenarios/${test}.log`), seed, intensity);
}

async function execute(testselector, loggerFactory, seed, intensity) {
    try {
        if (testselector == "all") {
            for (const test of TESTS) {
                await call(test);
            }
        } else {
            const test = assertContains({element: testselector, set: TESTS});
            await call(test);
        }
        console.info("OK :)");
    } catch (e) {
        console.info("¯\\_(ツ)_/¯: SORRY")
        console.info(e);
        throw e;
    }

    async function call(test) {
        const logger = loggerFactory(test);
        try {
            await runTest2({test: test, logger: logger, seed: seed, intensity: intensity, extra: {}});
        } finally {
            logger.flush();
        }
    }
}

async function reduce(test, limit, intensity) {
    try {
        test = assertContains({element: test, set: TESTS});
        if (!limit.match(/^\d+$/)) {
            console.info("Limit must be a number, got: \"" + limit + "\"");
            console.info();
            help();
            process.exit(1);
        }
        limit = parseInt(limit);

        let im = -1;
        let iv = limit;
        for (let i=0;i<500;i++) {
            let x = await call("" + i, iv, {log_size: iv, best_seed: im, try: i, of: 500});
            if (x < iv) {
                iv = x;
                im = "" + i;
            }
        }
    } catch (e) {
        console.info("¯\_(ツ)_/¯: ")
        console.info(e)
        throw e;
    }

    async function call(seed, limit, extra) {
        const logger = new LimitedVoid(limit);
        try {
            await runTest2({ test, logger, seed, intensity, extra});
            return logger.records;
        } catch(e) {
            console.info(e);
            return logger.records;
        } finally {
            logger.flush();
        }
    }
}

async function runTest2({test, logger, seed, intensity, extra}) {
    const op = JSON.stringify(Object.assign({ test: test, seed: seed, intensity: intensity }, extra))
    console.info(`# Running ${op}`);
    await (require(`./scenarios/${test}`).test)({seed: seed, logger: logger, intensity: intensity});
}

function assertContains({element, set} = {}) {
    if (set.indexOf(element)==-1) {
        console.info("Got \"" + element + "\". Expected: " + set);
        console.info();
        help();
        process.exit(1);
    }
    return element;
}

function help() {
    console.info("  node.js cpunit.js test-name|all record|replay|void|reduce seed");
    console.info();
    console.info("  Supported tests:");
    for (const test of TESTS) {
        console.info(`   * ${test}`);
    }
    console.info();
    console.info("  See tests folder for logs");
    console.info();
}