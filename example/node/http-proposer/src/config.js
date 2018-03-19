const fs = require('fs');
const Promise = require("bluebird");
const guid = require("uuid/v4");

Promise.promisifyAll(fs);

module.exports = {
    read: async dir => {
        let maxConfig = null;
        let maxName = null;
        for(let name of await fs.readdirAsync(dir)) {
            const conf = JSON.parse(await fs.readFileAsync(`${dir}/${name}`))
            if (maxConfig == null || conf.configVersion > maxConfig.configVersion) {
                maxConfig = conf;
                maxName = name;
            }
        }
        for(let name of await fs.readdirAsync(dir)) {
            if (name != maxName) {
                await fs.unlinkAsync(`${dir}/${name}`);
            }
        }
        return maxConfig;
    },
    write: async (dir, config) => {
        const name = guid();
        await fs.writeFileAsync(`${dir}/${name}.json`, JSON.stringify(config, null, 4));
    }
}