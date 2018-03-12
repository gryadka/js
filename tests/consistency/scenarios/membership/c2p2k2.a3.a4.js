const {Context} = require("../../lib/Context");

const {createProposer, createAcceptors} = require("../../lib/Mocks");
const {IncClient} = require("../../lib/clients/IncClient");
const {IncConsistencyChecker} = require("../../lib/clients/IncConsistencyChecker");
const {ReadAllKeysClient} = require("../../lib/clients/ReadAllKeysClient");
const {AcceptorMock} = require("../../lib/Acceptor");

const {Proxy} = require("../../lib/proxies/Proxy");
const {ShufflingProxy} = require("../../lib/proxies/ShufflingProxy");
const {LosingProxy} = require("../../lib/proxies/LosingProxy");
const {LoggingProxy} = require("../../lib/proxies/LoggingProxy");

const MAX_TIME_DELAY = 1000;

exports.test = async function({seed, logger, intensity=null}) {
    intensity = intensity || 200;
    const ctx = new Context(MAX_TIME_DELAY, seed);

    const network = Proxy.chain(
        LosingProxy.w({ctx: ctx, stability: .8}),
        ShufflingProxy.w({ctx: ctx, base: 3, variance: 10}), 
        LoggingProxy.w({ctx: ctx, logger: logger})
    );

    const progress = async ({client, steps}) => {
        const writes = client.stat.writes;
        await client.wait(x => x.stat.writes > writes + steps);
    };

    const keys = ["key1", "key2"];

    const checker = new IncConsistencyChecker();

    let prepareList = createAcceptors(ctx, ["a0", "a1", "a2"]);
    let acceptList = [...prepareList];
    
    const p2a3s = Array.from(new Array(2).keys()).map(i => createProposer({
        network: network,
        pidtime: i, pid: "p"+i,
        prepare: {nodes: prepareList, quorum: 2},
        accept: {nodes: acceptList, quorum: 2}
    }));

    const c1 = IncClient.spawn({
        ctx: ctx, id: "c1", proposers: p2a3s, keys: keys,
        consistencyChecker: checker
    });

    const c2 = IncClient.spawn({
        ctx: ctx, id: "c2", proposers: p2a3s, keys: keys,
        consistencyChecker: checker
    });

    ctx.timer.start();

    await progress({client: c1, steps: 10});
    await progress({client: c2, steps: 10});

    await c2.stop();

    acceptList = [...acceptList, new AcceptorMock(ctx, "a3")]

    const p2a3a4s = Array.from(new Array(2).keys()).map(i => createProposer({
        network: network,
        pidtime: i+2, pid: "p"+(i+2),
        prepare: {nodes: prepareList, quorum: 2},
        accept: {nodes: acceptList, quorum: 3}
    }));

    const c3 = IncClient.spawn({
        ctx: ctx, id: "c3", proposers: p2a3a4s, keys: keys,
        consistencyChecker: checker
    });

    await progress({client: c1, steps: 10});
    await progress({client: c3, steps: 10});

    await c1.stop();

    const c4 = IncClient.spawn({
        ctx: ctx, id: "c4", proposers: p2a3a4s, keys: keys,
        consistencyChecker: checker
    });

    await progress({client: c3, steps: 10});
    await progress({client: c4, steps: 10});

    const r1 = ReadAllKeysClient.spawn({
        ctx: ctx, id: "r2", proposers: p2a3a4s, keys: keys,
        consistencyChecker: checker
    });

    await r1.thread;

    await c3.stop();

    prepareList = [...acceptList];

    const p2a4s = Array.from(new Array(2).keys()).map(i => createProposer({
        network: network,
        pidtime: i+4, pid: "p"+(i+4),
        prepare: {nodes: prepareList, quorum: 3},
        accept: {nodes: acceptList, quorum: 3}
    }));

    const c5 = IncClient.spawn({
        ctx: ctx, id: "c5", proposers: p2a4s, keys: keys,
        consistencyChecker: checker
    });

    await progress({client: c4, steps: 10});
    await progress({client: c5, steps: 10});

    await c4.stop();

    const c6 = IncClient.spawn({
        ctx: ctx, id: "c6", proposers: p2a4s, keys: keys,
        consistencyChecker: checker
    });

    await progress({client: c5, steps: 10});
    await progress({client: c6, steps: 10});

    await c5.stop();
    await c6.stop();
    
    await ctx.timer.thread;
}