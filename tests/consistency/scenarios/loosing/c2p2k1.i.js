import {Context} from "../../lib/Context"

import {createProposer, createAcceptors} from "../../lib/Mocks"
import {IncClient, IncConsistencyChecker} from "../../lib/clients/IncClient"
import {isUpdateChangeNoError} from "../../lib/mutators"
import {isConcurrentNoError, isAcceptUnknownError, isProposeNoError, isLeadershipNoError, isLeadershipUnknownError} from "../../lib/clients/exceptions"

import {Proxy} from "../../lib/proxies/Proxy"
import {ShufflingProxy} from "../../lib/proxies/ShufflingProxy"
import {LoosingProxy} from "../../lib/proxies/LoosingProxy"
import {LoggingProxy} from "../../lib/proxies/LoggingProxy"

const MAX_TIME_DELAY = 1000;

export async function test({seed, logger, intensity=null}) {
    const ctx = new Context(MAX_TIME_DELAY, seed);

    const network = Proxy.chain(
        LoosingProxy.w({ctx: ctx, stability: .8}),
        ShufflingProxy.w({ctx: ctx, base: 3, variance: 10}), 
        LoggingProxy.w({ctx: ctx, logger: logger})
    );

    let acceptors = createAcceptors(ctx, ["a0", "a1", "a2"]);

    const ps = Array.from(new Array(2).keys()).map(i => createProposer({
        pidtime: i, pid: "p"+i, quorum: { read: 1, write: 1 },
        acceptorClients: {
            acceptors: acceptors,
            network: network,
            beingIntroduced: new Set([])
        }
    }));

    const checker = new IncConsistencyChecker();

    const c1 = IncClient.spawn({
        ctx: ctx, id: "c1", proposers: ps, keys: ["key1"],
        consistencyChecker: checker, recoverableErrors: [ isConcurrentNoError, isAcceptUnknownError, isProposeNoError, isLeadershipNoError, isLeadershipUnknownError, isUpdateChangeNoError ]
    });

    const c2 = IncClient.spawn({
        ctx: ctx, id: "c2", proposers: ps, keys: ["key1"],
        consistencyChecker: checker, recoverableErrors: [ isConcurrentNoError, isAcceptUnknownError, isProposeNoError, isLeadershipNoError, isLeadershipUnknownError, isUpdateChangeNoError ]
    });

    ctx.timer.start();

    logger.onError(e => {
        c1.raise(e);
        c2.raise(e);
    });

    try {
        await Promise.race([c1.thread, c2.thread]);
        throw new Error("Consistency violations were expected :(");
    } catch (e) {
        if (!IncConsistencyChecker.isConsistencyViolation(e)) {
            throw e;
        }
        try { await c1.stop(); } catch(e) { }
        try { await c2.stop(); } catch(e) { }
    }

    await ctx.timer.thread;
}