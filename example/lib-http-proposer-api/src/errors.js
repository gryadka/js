class UnknownChangeFunctionError extends Error {
    constructor(...args) {
        super(...args)
    }
}

class ConcurrentRequestError extends Error {
    constructor() {
        super()
    }
}

class UpdateError extends Error {
    constructor() {
        super()
    }
}

class CommitError extends Error {
    constructor() {
        super()
    }
}

class PrepareError extends Error {
    constructor() {
        super()
    }
}

class ProposerIsOff extends Error {
    constructor() {
        super()
    }
}

class UnexpectedResponseError extends Error {
    constructor(statusCode, body, message) {
        super(message)
        this.statusCode = statusCode;
        this.body = body;
    }
}

class UnexpectedError extends Error {
    constructor(err) {
        super()
        this.err = err;
    }
}

exports.UnexpectedError = UnexpectedError;
exports.UnexpectedResponseError = UnexpectedResponseError;
exports.PrepareError = PrepareError;
exports.CommitError = CommitError;
exports.UnknownChangeFunctionError = UnknownChangeFunctionError;
exports.ConcurrentRequestError = ConcurrentRequestError;
exports.UpdateError = UpdateError;
exports.ProposerIsOff = ProposerIsOff;