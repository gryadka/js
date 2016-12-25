import {Context} from "../../lib/Context"

import {createProposer, createAcceptors} from "../../lib/Mocks"
import {IncClient, IncConsistencyChecker} from "../../lib/clients/IncClient"
import {isUpdateChangeNoError} from "../../lib/mutators"
import {isConcurrentNoError, isAcceptUnknownError, isProposeNoError, isLeadershipNoError, isLeadershipUnknownError} from "../../lib/clients/exceptions"

import {Proxy} from "../../lib/proxies/Proxy"
import {ShufflingProxy} from "../../lib/proxies/ShufflingProxy"
import {LoosingProxy} from "../../lib/proxies/LoosingProxy"
import {LoggingProxy} from "../../lib/proxies/LoggingProxy"
import {FilteringProxy} from "../../lib/proxies/FilteringProxy"

const MAX_TIME_DELAY = 1000;

export async function test({seed, logger, intensity=null}) {
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
        LoosingProxy.w({ctx: ctx, stability: .8}),
        ShufflingProxy.w({ctx: ctx, base: 3, variance: 10}), 
        LoggingProxy.w({ctx: ctx, logger: logger})
    );

    let acceptors = createAcceptors(ctx, ["a0", "a1", "a2"]);

    const ps = Array.from(new Array(2).keys()).map(i => createProposer({
        pidtime: i, pid: "p"+i, quorum: { read: 2, write: 2 },
        acceptorClients: {
            acceptors: acceptors,
            network: network,
            beingIntroduced: new Set([])
        }
    }));

    const checker = new IncConsistencyChecker();

    const c1 = IncClient.spawn({
        ctx: ctx, id: "c1", proposers: ps, keys: ["key1", "key2"],
        consistencyChecker: checker, recoverableErrors: [ isConcurrentNoError, isAcceptUnknownError, isProposeNoError, isLeadershipNoError, isLeadershipUnknownError, isUpdateChangeNoError ]
    });

    const c2 = IncClient.spawn({
        ctx: ctx, id: "c2", proposers: ps, keys: ["key1", "key2"],
        consistencyChecker: checker, recoverableErrors: [ isConcurrentNoError, isAcceptUnknownError, isProposeNoError, isLeadershipNoError, isLeadershipUnknownError, isUpdateChangeNoError ]
    });

    ctx.timer.start();

    logger.onError(e => {
        c1.raise(e);
        c2.raise(e);
    });

    await c1.wait(x => x.stat.writes >= 30);
    await c2.wait(x => x.stat.writes >= 30);
    hasNetworkIssues = true;
    await c1.wait(x => x.stat.writes >= 170);
    await c2.wait(x => x.stat.writes >= 170);
    hasNetworkIssues = false;
    await c1.wait(x => x.stat.writes >= intensity);
    await c2.wait(x => x.stat.writes >= intensity);
    
    await c1.stop();
    await c2.stop();
    
    await ctx.timer.thread;
}