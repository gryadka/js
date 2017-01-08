import redisAsyncClient from "../utils/redisAsyncClient"
import fs from "fs"

(async function() {
    const settings = JSON.parse(fs.readFileSync(process.argv[2])); 
    const redis = redisAsyncClient(settings.acceptors[process.argv[3]].port, settings.acceptors[process.argv[3]].host);
    const keys = await redis.keysAsync("*/promise");
    for (const key of keys) {
        console.info(key.replace(/([^\/]*)\/promise/, "$1"));
    }
    redis.quit();
})();