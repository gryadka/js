const request = require("request");
const {UnexpectedError, UnexpectedResponseError, PrepareError, CommitError, UnknownChangeFunctionError, ConcurrentRequestError, UpdateError} = require("./errors");

async function registerChange(endpoint, name, body) {
    return new Promise((resolve, reject) => {
        request(
            {
                method: 'post',
                url: endpoint + "/register-change",
                json: {
                    "name": name,
                    "body": body
                },
                timeout: 1000
            }, 
            (err, res, body) => {
                if (err) {
                    reject(new UnexpectedError(err));
                } else {
                    if (res.statusCode != 200) {
                        reject(new UnexpectedResponse(res.statusCode, body));
                    } else {
                        resolve(null);
                    }
                }
            }
        );
    });
}

async function change(endpoint, name, key, params) {
    return new Promise((resolve, reject) => {
        request(
            {
                method: 'post',
                url: endpoint + "/change",
                json: {
                    "name": name,
                    "key": key,
                    "params": params
                },
                timeout: 1000
            }, 
            (err, res, body) => {
                if (err) {
                    reject(new UnexpectedError(err))
                } else {
                    if (res.statusCode == 404 && body.code == "UnknownChangeFunction") {
                        reject(new UnknownChangeFunctionError());
                    } else if (res.statusCode == 400 && body.code == "UpdateError") {
                        reject(new UpdateError());
                    } else if (res.statusCode == 400 && body.code == "PrepareError") {
                        reject(new PrepareError());
                    } else if (res.statusCode == 400 && body.code == "CommitError") {
                        reject(new CommitError());
                    } else if (res.statusCode == 400 && body.code == "ConcurrentRequestError") {
                        reject(new ConcurrentRequestError());
                    } else if (res.statusCode == 200) {
                        resolve(body.value);
                    } else {
                        console.info(body);
                        reject(new UnexpectedResponse(res.statusCode, body));
                    }
                }
            }
        );
    });
}

async function getConfiguration(endpoint) {
    return new Promise((resolve, reject) => {
        request(
            {
                method: 'get',
                url: endpoint + "/configuration",
                timeout: 1000
            }, 
            (err, res, body) => {
                if (err) {
                    reject(new UnexpectedError(err));
                } else {
                    if (res.statusCode != 200) {
                        reject(new UnexpectedResponse(res.statusCode, body));
                    } else {
                        try {
                            resolve(JSON.parse(body));
                        } catch (e) {
                            reject(new UnexpectedResponse(res.statusCode, body, "JSON.parse error"));
                        }
                    }
                }
            }
        );
    });
}

async function postConfiguration(endpoint, config) {
    return new Promise((resolve, reject) => {
        request(
            {
                method: 'post',
                url: endpoint + "/configuration",
                json: config,
                timeout: 1000
            }, 
            (err, res, body) => {
                if (err) {
                    reject(new UnexpectedError(err));
                } else {
                    if (res.statusCode != 200) {
                        reject(new UnexpectedResponse(res.statusCode, body));
                    } else {
                        resolve(null);
                    }
                }
            }
        );
    });
}

exports.change = change;
exports.registerChange = registerChange;
exports.getConfiguration = getConfiguration;
exports.postConfiguration = postConfiguration;