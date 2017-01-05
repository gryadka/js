import {Context} from "../../lib/Context"

import {createProposer, createAcceptors} from "../../lib/Mocks"
import {IncClient} from "../../lib/clients/IncClient"
import {IncConsistencyChecker} from "../../lib/clients/IncConsistencyChecker"
import {ReadAllKeysClient} from "../../lib/clients/ReadAllKeysClient"

import {isUpdateChangeNoError} from "../../lib/mutators"
import {isConcurrentNoError, isAcceptUnknownError, isProposeNoError} from "../../lib/clients/exceptions"

import {Proxy} from "../../lib/proxies/Proxy"
import {ShufflingProxy} from "../../lib/proxies/ShufflingProxy"
import {LoosingProxy} from "../../lib/proxies/LoosingProxy"
import {LoggingProxy} from "../../lib/proxies/LoggingProxy"

const MAX_TIME_DELAY = 1000;

const range = n => Array.from(new Array(2).keys());
const progress = async ({client, steps}) => {
    const writes = client.stat.writes;
    await client.wait(x => x.stat.writes > writes + steps);
};


class MembershipFlux {
    constructor({ctx, keys, checker, network, recoverableErrors}) {
        this.ctx = ctx;
        this.keys = keys;
        this.checker = checker;
        this.network = network;
        this.recoverableErrors = recoverableErrors;
        this.pid = 0;
        this.cid = 0;
        this.rid = 0;
        this.aid = 0;
    }
    
    mkProposer({ quorum, acceptors, beingIntroduced = [] }) {
        const id = (this.pid++);
        return createProposer({
            pidtime: id, pid: "p"+id, quorum: quorum,
            acceptorClients: { acceptors: acceptors, network: this.network, beingIntroduced: new Set(beingIntroduced) }
        })
    }

    mkClient({ proposers }) {
        return IncClient.spawn({
            ctx: this.ctx, id: "c" + (this.cid++), proposers: proposers, keys: this.keys,
            consistencyChecker: this.checker, recoverableErrors: this.recoverableErrors
        });
    }

    mkSyncer({ proposers }) {
        return ReadAllKeysClient.spawn({
            ctx: this.ctx, id: "r" + (this.rid++), proposers: proposers, keys: this.keys,
            consistencyChecker: this.checker, recoverableErrors: this.recoverableErrors
        });
    }

    mkAcceptor() {
        return createAcceptors(this.ctx, ["a" + (this.aid++)])[0];
    }

    init() {
        this.acceptors = createAcceptors(this.ctx, ["a0", "a1", "a2"]);
    
        const p2s = [
            this.mkProposer({quorum: { read: 2, write: 2 }, acceptors: this.acceptors}),
            this.mkProposer({quorum: { read: 2, write: 2 }, acceptors: this.acceptors})
        ];
        
        this.clients = [
            this.mkClient({ proposers: p2s }),
            this.mkClient({ proposers: p2s })
        ];
    }

    async stretch() {
        const acceptor = this.mkAcceptor();
        this.acceptors = this.acceptors.concat([ acceptor ]);
        
        const p2tr = range(2).map(_ => this.mkProposer({
            quorum: { read: 3, write: 3 }, 
            acceptors: this.acceptors, 
            beingIntroduced: [acceptor.aid]
        }));

        const c2tr = [];
        while (this.clients.length > 0) {
            const old = this.clients.pop();
            await old.stop();
            const fresh = this.mkClient({ proposers: p2tr });
            await progress({client: fresh, steps: 3});
            c2tr.push(fresh);
        }
        this.clients = c2tr;

        await (this.mkSyncer({ proposers: p2tr }).thread);

        const p2last = range(2).map(_ => this.mkProposer({
            quorum: { read: 3, write: 3 }, 
            acceptors: this.acceptors
        }));

        const c2last = [];
        while (this.clients.length > 0) {
            const old = this.clients.pop();
            await old.stop();
            const fresh = this.mkClient({ proposers: p2last });
            await progress({client: fresh, steps: 3});
            c2last.push(fresh);
        }
        this.clients = c2last;
    }

    async shrink() {
        const acceptor = this.ctx.random.anyOf(this.acceptors);
        
        const p2tr = range(2).map(_ => this.mkProposer({
            quorum: { read: 3, write: 3 }, 
            acceptors: this.acceptors, 
            beingIntroduced: [acceptor.aid]
        }));

        this.acceptors = this.acceptors.filter(x => x != acceptor);

        const c2tr = [];
        while (this.clients.length > 0) {
            const old = this.clients.pop();
            await old.stop();
            const fresh = this.mkClient({ proposers: p2tr });
            await progress({client: fresh, steps: 3});
            c2tr.push(fresh);
        }
        this.clients = c2tr;

        await (this.mkSyncer({ proposers: p2tr }).thread);

        const p2last = range(2).map(_ => this.mkProposer({
            quorum: { read: 2, write: 2 }, 
            acceptors: this.acceptors
        }));

        const c2last = [];
        while (this.clients.length > 0) {
            const old = this.clients.pop();
            await old.stop();
            const fresh = this.mkClient({ proposers: p2last });
            await progress({client: fresh, steps: 3});
            c2last.push(fresh);
        }
        this.clients = c2last;
    }
}

export async function test({seed, logger, intensity=null}) {
    intensity = intensity || 200;
    const ctx = new Context(MAX_TIME_DELAY, seed);

    const flux = new MembershipFlux({
        ctx: ctx,
        keys: ["key1", "key2"],
        checker: new IncConsistencyChecker(),
        network: Proxy.chain(
            LoosingProxy.w({ctx: ctx, stability: .8}),
            ShufflingProxy.w({ctx: ctx, base: 3, variance: 10}), 
            LoggingProxy.w({ctx: ctx, logger: logger})
        ),
        recoverableErrors: [ 
            isConcurrentNoError, isAcceptUnknownError, isProposeNoError, 
            isUpdateChangeNoError 
        ]
    });

    flux.init();

    ctx.timer.start();

    for (let i=0;i<2;i++) {
        await flux.stretch();
        await flux.shrink();
    }

    for (const client of flux.clients) {
        await client.stop();
    }
    
    await ctx.timer.thread;
}