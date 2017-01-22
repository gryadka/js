class LoggingProxy {
    static w({ctx, logger}) {
        return service => new LoggingProxy(ctx, service, logger);
    }
    constructor(ctx, service, logger) {
        this.service = service;
        this.logger = logger;
        this.ctx = ctx;
    }
    async handler(request) {
        this.logger.log(JSON.stringify(request));
        const response = await this.service.handler(request);
        this.logger.log(JSON.stringify(response));
        return response;
    }
}

exports.LoggingProxy = LoggingProxy;