import redis from "redis";
import Promise from "bluebird";

Promise.promisifyAll(redis.RedisClient.prototype);

export default function redisAsyncClient(port, host) {
    return redis.createClient({port: port, host: host, retry_strategy: options=>2000});
}