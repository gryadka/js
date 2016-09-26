import redisAsyncClient from "../src/mvpaxos/utils/redisAsyncClient"
import fs from "fs"

(async function() {
    const settings = JSON.parse(fs.readFileSync(process.argv[2])); 
    const redis = redisAsyncClient(settings.port, settings.host);
    const keys = await redis.keysAsync(settings.prefix + "*/promise");
    for (const key of keys) {
        console.info(key.replace(/[^\/]*\/([^\/]*)\/promise/, "$1"));
    }
    redis.quit();
})();