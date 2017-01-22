class ShufflingProxy {
    static w({ctx, base, variance}) {
        return service => new ShufflingProxy(ctx, base, variance, service);
    }
    constructor(ctx, base, variance, service) {
        this.ctx = ctx;
        this.service = service;
        this.base = base;
        this.variance = variance;
    }
    handler(request) {
        return new Promise((resolve, reject) => {
            this.ctx.timer.postpone(this.base + this.ctx.random.next(this.variance), () => {
                (async () => {
                    try {
                        var result = await this.service.handler(request);
                        resolve(result);
                    } catch (e) {
                        reject(e);
                    }
                    return 0;
                })();
            });
        });
    }
}

exports.ShufflingProxy = ShufflingProxy;