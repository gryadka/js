const {Context} = require("../../lib/Context");

const {createProposer, createAcceptors} = require("../../lib/Mocks");
const {IncClient} = require("../../lib/clients/IncClient");
const {IncConsistencyChecker} = require("../../lib/clients/IncConsistencyChecker");
const {ReadAllKeysClient} = require("../../lib/clients/ReadAllKeysClient");

const {isUpdateChangeNoError} = require("../../lib/mutators");
const {isConcurrentNoError, isAcceptUnknownError, isProposeNoError} = require("../../lib/clients/exceptions");

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
    
    const recoverableErrors = [ 
        isConcurrentNoError, isAcceptUnknownError, isProposeNoError, 
        isUpdateChangeNoError 
    ];

    const a3s = createAcceptors(ctx, ["a0", "a1", "a2"]);
    const p2a3s = Array.from(new Array(2).keys()).map(i => createProposer({
        pidtime: i, pid: "p"+i, quorum: { read: 2, write: 2 },
        acceptorClients: { acceptors: a3s, network: network, transient: new Set([]) }
    }));

    const c1 = IncClient.spawn({
        ctx: ctx, id: "c1", proposers: p2a3s, keys: keys,
        consistencyChecker: checker, recoverableErrors: recoverableErrors
    });

    const c2 = IncClient.spawn({
        ctx: ctx, id: "c2", proposers: p2a3s, keys: keys,
        consistencyChecker: checker, recoverableErrors: recoverableErrors
    });

    ctx.timer.start();

    await progress({client: c1, steps: 10});
    await progress({client: c2, steps: 10});

    await c2.stop();

    const a4s = a3s.concat(createAcceptors(ctx, ["a3"]));
    const p2a3a4s = Array.from(new Array(2).keys()).map(i => createProposer({
        pidtime: i+2, pid: "p"+(i+2), quorum: { read: 3, write: 3 },
        acceptorClients: { acceptors: a4s, network: network, transient: new Set(["a3"]) }
    }));

    const c3 = IncClient.spawn({
        ctx: ctx, id: "c3", proposers: p2a3a4s, keys: keys,
        consistencyChecker: checker, recoverableErrors: recoverableErrors
    });

    await progress({client: c1, steps: 10});
    await progress({client: c3, steps: 10});

    await c1.stop();

    const c4 = IncClient.spawn({
        ctx: ctx, id: "c4", proposers: p2a3a4s, keys: keys,
        consistencyChecker: checker, recoverableErrors: recoverableErrors
    });

    await progress({client: c3, steps: 10});
    await progress({client: c4, steps: 10});

    const r1 = ReadAllKeysClient.spawn({
        ctx: ctx, id: "r2", proposers: p2a3a4s, keys: keys,
        consistencyChecker: checker, recoverableErrors: recoverableErrors
    });

    await r1.thread;

    await c3.stop();

    const p2a4s = Array.from(new Array(2).keys()).map(i => createProposer({
        pidtime: i+4, pid: "p"+(i+4), quorum: { read: 3, write: 3 },
        acceptorClients: { acceptors: a4s, network: network, transient: new Set([]) }
    }));

    const c5 = IncClient.spawn({
        ctx: ctx, id: "c5", proposers: p2a4s, keys: keys,
        consistencyChecker: checker, recoverableErrors: recoverableErrors
    });

    await progress({client: c4, steps: 10});
    await progress({client: c5, steps: 10});

    await c4.stop();

    const c6 = IncClient.spawn({
        ctx: ctx, id: "c6", proposers: p2a4s, keys: keys,
        consistencyChecker: checker, recoverableErrors: recoverableErrors
    });

    await progress({client: c5, steps: 10});
    await progress({client: c6, steps: 10});

    await c5.stop();
    await c6.stop();
    
    await ctx.timer.thread;
}