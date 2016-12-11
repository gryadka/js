import {Context} from "../../lib/Context"

import {createProposer, createAcceptors} from "../../lib/Mocks"
import {IncClient, IncConsistencyChecker} from "../../lib/clients/IncClient"
import {isAcceptUnknownError, isProposeNoError} from "../../lib/clients/exceptions"

import {Proxy} from "../../lib/proxies/Proxy"
import {ShufflingProxy} from "../../lib/proxies/ShufflingProxy"
import {LoosingProxy} from "../../lib/proxies/LoosingProxy"
import {LoggingProxy} from "../../lib/proxies/LoggingProxy"
import {FilteringProxy} from "../../lib/proxies/FilteringProxy"

const MAX_TIME_DELAY = 1000;

export async function test(seed, logger) {
    const ctx = new Context(MAX_TIME_DELAY, seed);

    let isIgnoringA0 = false;

    const network = Proxy.chain(
        FilteringProxy.w({ctx: ctx, ignoreIf: req => {
            return (req.aid == "a0") && isIgnoringA0;
        }}),
        LoosingProxy.w({ctx: ctx, stability: .8}), 
        ShufflingProxy.w({ctx: ctx, base: 3, variance: 10}), 
        LoggingProxy.w({ctx: ctx, logger: logger})
    );

    let acceptors = createAcceptors(ctx, ["a0", "a1", "a2"]);

    const p1 = createProposer({
        pidtime: 1, pid: "p1", quorum: { read: 2, write: 2 },
        acceptorClients: {
            acceptors: acceptors,
            network: network,
            beingIntroduced: new Set([])
        },
        isLeaderless: false
    });

    const c1 = IncClient.spawn({
        ctx: ctx, id: "c1", proposers: [p1], keys: ["key1"],
        consistencyChecker: new IncConsistencyChecker(), 
        recoverableErrors: [isAcceptUnknownError, isProposeNoError]
    });

    ctx.timer.start();

    logger.onError(x => c1.raise(x));

    await c1.wait(x => x.stat.writes == 30);
    isIgnoringA0 = true;
    await c1.wait(x => x.stat.writes == 170);
    isIgnoringA0 = false;
    await c1.wait(x => x.stat.writes == 200);

    await c1.stop();
    await ctx.timer.thread;
}