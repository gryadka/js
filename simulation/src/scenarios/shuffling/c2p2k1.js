const {Context} = require("../../lib/Context");

const {createProposer, createAcceptors} = require("../../lib/Mocks");
const {IncClient} = require("../../lib/clients/IncClient");
const {IncConsistencyChecker} = require("../../lib/clients/IncConsistencyChecker");

const {Proxy} = require("../../lib/proxies/Proxy");
const {ShufflingProxy} = require("../../lib/proxies/ShufflingProxy");
const {LosingProxy} = require("../../lib/proxies/LosingProxy");
const {LoggingProxy} = require("../../lib/proxies/LoggingProxy");

const MAX_TIME_DELAY = 1000;

exports.test = async function ({seed, logger, intensity=null}) {
    intensity = intensity || 500;
    const ctx = new Context(MAX_TIME_DELAY, seed);

    const network = Proxy.chain(
        ShufflingProxy.w({ctx: ctx, base: 3, variance: 10}), 
        LoggingProxy.w({ctx: ctx, logger: logger})
    );

    let acceptors = createAcceptors(ctx, ["a0", "a1", "a2"]);

    const ps = [];
    for (let i=1;i<3;i++) {
        ps.push(createProposer({
            network: network,
            pidtime: i, pid: "p"+i,
            prepare: {nodes: acceptors, quorum: 2},
            accept: {nodes: acceptors, quorum: 2}
        }));
    }

    const checker = new IncConsistencyChecker();

    const c1 = IncClient.spawn({
        ctx: ctx, id: "c1", proposers: ps, keys: ["key1"],
        consistencyChecker: checker
    });

    const c2 = IncClient.spawn({
        ctx: ctx, id: "c2", proposers: ps, keys: ["key1"],
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

    await c1.wait(x => x.stat.writes >= intensity);
    await c2.wait(x => x.stat.writes >= intensity);
    await c1.stop();
    await c2.stop();
    await ctx.timer.thread;
}