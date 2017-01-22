class LosingProxy {
    static w({ctx, stability}) {
        return service => new LosingProxy(ctx, stability, service);
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
            return Promise.reject(new Error());
        }
    }
}

exports.LosingProxy = LosingProxy;