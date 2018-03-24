const {Context} = require("../../lib/Context");

const {createProposer, createAcceptors} = require("../../lib/Mocks");
const {IncClient} = require("../../lib/clients/IncClient");
const {IncConsistencyChecker} = require("../../lib/clients/IncConsistencyChecker");

const {Proxy} = require("../../lib/proxies/Proxy");
const {ShufflingProxy} = require("../../lib/proxies/ShufflingProxy");
const {LosingProxy} = require("../../lib/proxies/LosingProxy");
const {LoggingProxy} = require("../../lib/proxies/LoggingProxy");
const {FilteringProxy} = require("../../lib/proxies/FilteringProxy");

const MAX_TIME_DELAY = 1000;

exports.test = async function ({seed, logger, intensity=null}) {
    intensity = intensity || 200;
    intensity = Math.max(intensity, 200);
    const ctx = new Context(MAX_TIME_DELAY, seed);

    let hasNetworkIssues = false;

    const network = Proxy.chain(
        FilteringProxy.w({ctx: ctx, ignoreIf: req => {
            return hasNetworkIssues && (
                (req.aid == "a0" && req.pid == "p1") ||
                (req.aid == "a2" && req.pid == "p0")
            );
        }}),
        LosingProxy.w({ctx: ctx, stability: .8}),
        ShufflingProxy.w({ctx: ctx, base: 3, variance: 10}), 
        LoggingProxy.w({ctx: ctx, logger: logger})
    );

    let acceptors = createAcceptors(ctx, ["a0", "a1", "a2"]);

    const ps = Array.from(new Array(2).keys()).map(i => createProposer({
        network: network,
        pidtime: i, pid: "p"+i,
        prepare: {nodes: acceptors, quorum: 2},
        accept: {nodes: acceptors, quorum: 2}
    }));

    const checker = new IncConsistencyChecker();

    const c1 = IncClient.spawn({
        ctx: ctx, id: "c1", proposers: ps, keys: ["key1", "key2"],
        consistencyChecker: checker
    });

    const c2 = IncClient.spawn({
        ctx: ctx, id: "c2", proposers: ps, keys: ["key1", "key2"],
        consistencyChecker: checker
    });

    checker.onConsistencyViolation(e => {
        c1.raise(e);
        c2.raise(e);
    });

    logger.onError(e => {
        c1.raise(e);
        c2.raise(e);
    });

    ctx.timer.start();

    while (true) {
        hasNetworkIssues = !hasNetworkIssues;
        const c1written = c1.stat.writes;
        const c2written = c1.stat.writes;
        await Promise.all([
            c1.wait(x => x.stat.writes >= c1written + ctx.random.next(4)),
            c2.wait(x => x.stat.writes >= c2written + ctx.random.next(4))
        ]);
        if (c1.stat.writes >= intensity && c2.stat.writes >= intensity) {
            break;
        }
    }

    await c1.stop();
    await c2.stop();
    
    await ctx.timer.thread;
}