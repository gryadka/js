import {FailRequestError} from "../../../../src/paxos/utils/MultiRequest"

export class LoosingProxy {
    static w({ctx, stability}) {
        return service => new LoosingProxy(ctx, stability, service);
    }
    constructor(ctx, stability, service) {
        this.ctx = ctx;
        this.service = service;
        this.stability = stability;
    }
    handler(request) {
        if (this.ctx.random.random() <= this.stability) {
            return this.service.handler(request);
        } else {
            return Promise.reject(new FailRequestError());
        }
    }
}