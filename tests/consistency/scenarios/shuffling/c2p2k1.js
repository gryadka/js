import {Context} from "../../lib/Context"

import {createProposer, createAcceptors} from "../../lib/Mocks"
import {IncClient, IncConsistencyChecker} from "../../lib/clients/IncClient"
import {isUpdateChangeNoError} from "../../lib/mutators"
import {isConcurrentNoError, isLeadershipUnknownError, isLeadershipNoError} from "../../lib/clients/exceptions"

import {Proxy} from "../../lib/proxies/Proxy"
import {ShufflingProxy} from "../../lib/proxies/ShufflingProxy"
import {LoosingProxy} from "../../lib/proxies/LoosingProxy"
import {LoggingProxy} from "../../lib/proxies/LoggingProxy"

const MAX_TIME_DELAY = 1000;

export async function test(seed, logger) {
    const ctx = new Context(MAX_TIME_DELAY, seed);

    const network = Proxy.chain(
        ShufflingProxy.w({ctx: ctx, base: 3, variance: 10}), 
        LoggingProxy.w({ctx: ctx, logger: logger})
    );

    let acceptors = createAcceptors(ctx, ["a0", "a1", "a2"]);

    const ps = [];
    for (let i=1;i<3;i++) {
        ps.push(createProposer({
            pidtime: i, pid: "p"+i, quorum: { read: 2, write: 2 },
            acceptorClients: {
                acceptors: acceptors,
                network: network,
                beingIntroduced: new Set([])
            },
            isLeaderless: false
        }));
    }

    const checker = new IncConsistencyChecker();

    const c1 = IncClient.spawn({
        ctx: ctx, id: "c1", proposers: ps, keys: ["key1"],
        consistencyChecker: checker, 
        recoverableErrors: [ isConcurrentNoError, isLeadershipUnknownError, isLeadershipNoError, isUpdateChangeNoError ]
    });

    const c2 = IncClient.spawn({
        ctx: ctx, id: "c2", proposers: ps, keys: ["key1"],
        consistencyChecker: checker, 
        recoverableErrors: [ isConcurrentNoError, isLeadershipUnknownError, isLeadershipNoError, isUpdateChangeNoError ]
    });

    ctx.timer.start();

    logger.onError(e => {
        c1.raise(e);
        c2.raise(e);
    });

    await c1.wait(x => x.stat.writes >= 500);
    await c2.wait(x => x.stat.writes >= 500);
    await c1.stop();
    await c2.stop();
    await ctx.timer.thread;
}