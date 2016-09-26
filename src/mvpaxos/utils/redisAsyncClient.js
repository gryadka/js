import redis from "redis";
import Promise from "bluebird";

Promise.promisifyAll(redis.RedisClient.prototype);

export default function redisAsyncClient(port, host) {
    return redis.createClient(port, host);
}