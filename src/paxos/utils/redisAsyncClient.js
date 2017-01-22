const redis = require("redis");
const Promise = require("bluebird");

Promise.promisifyAll(redis.RedisClient.prototype);

function redisAsyncClient(port, host) {
    return redis.createClient({port: port, host: host, retry_strategy: options=>2000});
}

exports.redisAsyncClient = redisAsyncClient;