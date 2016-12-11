
export class DelayProxy {
    static w(ctx, delay) {
        return service => new DelayProxy(ctx, service, delay);
    }
    constructor(ctx, service, delay) {
        this.ctx = ctx;
        this.service = service;
        this.delay = delay;
    }
    handler(request) {
        return new Promise((resolve, reject) => {
            this.ctx.timer.postpone(this.delay, () => {
                (async () => {
                    try {
                        var result = await this.service.handler(request);
                        resolve(result);
                    } catch (e) {
                        reject(e);
                    }
                })();
            });
        });
    }
}