import {FailRequestError} from "../../../../src/mvpaxos/utils/MultiRequest"

export class FilteringProxy {
    static w({ctx, ignoreIf}) {
        return service => new FilteringProxy(ctx, ignoreIf, service);
    }
    constructor(ctx, ignoreIf, service) {
        this.ctx = ctx;
        this.service = service;
        this.ignoreIf = ignoreIf;
    }
    handler(request) {
        if (!this.ignoreIf(request)) {
            return this.service.handler(request);
        } else {
            return Promise.reject(new Error("ignoring request"));
        }
    }
}