const {Context} = require("../../lib/Context");

const {createProposer, createAcceptors} = require("../../lib/Mocks");
const {IncClient} = require("../../lib/clients/IncClient");
const {IncConsistencyChecker, ConsistencyViolation} = require("../../lib/clients/IncConsistencyChecker");

const {Proxy} = require("../../lib/proxies/Proxy");
const {ShufflingProxy} = require("../../lib/proxies/ShufflingProxy");
const {LosingProxy} = require("../../lib/proxies/LosingProxy");
const {LoggingProxy} = require("../../lib/proxies/LoggingProxy");

const MAX_TIME_DELAY = 1000;

exports.test = async function ({seed, logger, intensity=null}) {
    try {
        intensity = intensity || 1000;
        const ctx = new Context(MAX_TIME_DELAY, seed);

        const network = Proxy.chain(
            LosingProxy.w({ctx: ctx, stability: .8}),
            ShufflingProxy.w({ctx: ctx, base: 3, variance: 10}), 
            LoggingProxy.w({ctx: ctx, logger: logger})
        );

        let acceptors = createAcceptors(ctx, ["a0", "a1", "a2"]);

        const ps = Array.from(new Array(2).keys()).map(i => createProposer({
            network: network,
            pidtime: i, pid: "p"+i,
            prepare: {nodes: acceptors, quorum: 2},
            accept: {nodes: acceptors, quorum: 1}
        }));

        const checker = new IncConsistencyChecker();

        const c1 = IncClient.spawn({
            ctx: ctx, id: "c1", proposers: ps, keys: ["key1"], consistencyChecker: checker
        });

        const c2 = IncClient.spawn({
            ctx: ctx, id: "c2", proposers: ps, keys: ["key1"], consistencyChecker: checker
        });

        ctx.timer.start();

        logger.onError(e => {
            c1.raise(e);
            c2.raise(e);
        });

        await c1.wait(x => x.stat.writes >= intensity);
        await c2.wait(x => x.stat.writes >= intensity);
        await c1.stop();
        await c2.stop();
        await ctx.timer.thread;

        console.info("You should have seen consistency violation :(");
    } catch (e) {
        if (e instanceof ConsistencyViolation) {
            console.info("consistency violation!")
        } else {
            throw e;
        }
    }
}