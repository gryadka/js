const {Context} = require("../../lib/Context");

const {createProposer, createAcceptors} = require("../../lib/Mocks");
const {IncClient} = require("../../lib/clients/IncClient");
const {IncConsistencyChecker} = require("../../lib/clients/IncConsistencyChecker");

const {Proxy} = require("../../lib/proxies/Proxy");
const {ShufflingProxy} = require("../../lib/proxies/ShufflingProxy");
const {LosingProxy} = require("../../lib/proxies/LosingProxy");
const {LoggingProxy} = require("../../lib/proxies/LoggingProxy");

const MAX_TIME_DELAY = 1000;

exports.test = async function({seed, logger, intensity=null}) {
    intensity = intensity || 100;
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
        accept: {nodes: acceptors, quorum: 2}
    }));

    const checker = new IncConsistencyChecker();

    const keys = ["key1", "key2"];
    const clients = [];

    for (let i=0;i<6;i++) {
        const client = IncClient.spawn({
            ctx: ctx, id: "c" + i, proposers: ps, keys: keys,
            consistencyChecker: checker
        });
        clients.push(client);
    }

    ctx.timer.start();

    logger.onError(e => {
        for (const client of clients) {
            client.raise(e);
        }
    });

    for (const client of clients) {
        await client.wait(x => x.stat.writes >= intensity);
    }

    for (const client of clients) {
        await client.stop();
    }

    await ctx.timer.thread;
}