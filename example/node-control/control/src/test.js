const {getConfiguration, postConfiguration} = require("lib-http-proposer-api");

(async () => {
    const endpoint = "http://acceptor-proposer-1:8080";

    try {
        let config = await getConfiguration(endpoint);
        console.info(config);
        //await postConfiguration(endpoint, config);
        //config = await getConfiguration(endpoint);
        //console.info(config);
    } catch (e) {
        console.info(e);
    }
})();