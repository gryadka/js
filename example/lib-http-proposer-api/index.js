const {change, registerChange, getConfiguration, postConfiguration} = require("./src/api")
const {UnexpectedError, UnexpectedResponseError, PrepareError, CommitError, UnknownChangeFunctionError, ConcurrentRequestError, UpdateError} = require("./src/errors");

exports.change = change;
exports.registerChange = registerChange;
exports.getConfiguration = getConfiguration;
exports.postConfiguration = postConfiguration;
exports.UnexpectedError = UnexpectedError;
exports.UnexpectedResponseError = UnexpectedResponseError;
exports.PrepareError = PrepareError;
exports.CommitError = CommitError;
exports.UnknownChangeFunctionError = UnknownChangeFunctionError;
exports.ConcurrentRequestError = ConcurrentRequestError;
exports.UpdateError = UpdateError;