const {Context} = require("../../lib/Context");

const {createProposer, createAcceptors} = require("../../lib/Mocks");
const {IncClient} = require("../../lib/clients/IncClient");
const {IncConsistencyChecker} = require("../../lib/clients/IncConsistencyChecker");
const {ReadAllKeysClient} = require("../../lib/clients/ReadAllKeysClient");
const {AcceptorMock} = require("../../lib/Acceptor");

const {isUpdateChangeNoError} = require("../../lib/mutators");
const {isConcurrentNoError, isAcceptUnknownError, isProposeNoError} = require("../../lib/clients/exceptions");

const {Proxy} = require("../../lib/proxies/Proxy");
const {ShufflingProxy} = require("../../lib/proxies/ShufflingProxy");
const {LosingProxy} = require("../../lib/proxies/LosingProxy");
const {LoggingProxy} = require("../../lib/proxies/LoggingProxy");

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
        this.acceptor = null;
        this.pid = 0;
        this.cid = 0;
        this.rid = 0;
        this.aid = 0;
    }
    
    mkProposer({ prepare, accept }) {
        const id = (this.pid++);

        return createProposer({
            network: this.network,
            pidtime: id, pid: "p"+id,
            prepare: prepare,
            accept: accept
        });
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
            consistencyChecker: this.checker
        });
    }

    mkAcceptor() {
        return new AcceptorMock(this.ctx, "a" + (this.aid++));
    }

    init() {
        this.prepareList = range(3).map(_ => this.mkAcceptor());
        this.acceptList = [...this.prepareList];

        const p2s = [
            this.mkProposer({
                prepare: {nodes: this.prepareList, quorum: 2},
                accept: {nodes: this.acceptList, quorum: 2}
            }),
            this.mkProposer({
                prepare: {nodes: this.prepareList, quorum: 2},
                accept: {nodes: this.acceptList, quorum: 2}
            })
        ];
        
        this.clients = [
            this.mkClient({ proposers: p2s }),
            this.mkClient({ proposers: p2s })
        ];
    }

    async stretch() {
        const acceptor = this.mkAcceptor();
        
        let prepareList = [...this.prepareList];
        let acceptList = [...this.acceptList, acceptor];
        
        const p2tr = range(2).map(_ => this.mkProposer({
            prepare: {nodes: prepareList, quorum: 2},
            accept: {nodes: acceptList, quorum: 3}
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

        prepareList = [...acceptList];

        const p2last = range(2).map(_ => this.mkProposer({
            prepare: {nodes: prepareList, quorum: 3},
            accept: {nodes: acceptList, quorum: 3}
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
        this.prepareList = prepareList;
        this.acceptList = acceptList;
    }

    async shrink() {
        const removing = this.ctx.random.anyOf(this.acceptList);

        let prepareList = this.prepareList.filter(x => x != removing);
        let acceptList = [...this.acceptList];
        
        const p2tr = range(2).map(_ => this.mkProposer({
            prepare: {nodes: prepareList, quorum: 2},
            accept: {nodes: acceptList, quorum: 3}
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

        acceptList = [...prepareList];

        const p2last = range(2).map(_ => this.mkProposer({
            prepare: {nodes: prepareList, quorum: 2},
            accept: {nodes: acceptList, quorum: 2}
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
        this.prepareList = prepareList;
        this.acceptList = acceptList;
    }
}

exports.test = async function({seed, logger, intensity=null}) {
    intensity = intensity || 200;
    const ctx = new Context(MAX_TIME_DELAY, seed);

    const flux = new MembershipFlux({
        ctx: ctx,
        keys: ["key1", "key2"],
        checker: new IncConsistencyChecker(),
        network: Proxy.chain(
            LosingProxy.w({ctx: ctx, stability: .8}),
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