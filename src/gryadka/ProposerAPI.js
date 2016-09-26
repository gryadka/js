import request from "request";

export function changeQuery(proposerUrl, key, changeName, changeArgs, queryName, queryArgs, timeout) {
    return new Promise((resolve, reject) => {
        request(
            {
                method: 'post',
                body: {
                    "key": key,
                    "change": { "name": changeName, "args": changeArgs },
                    "query": { "name": queryName, "args": queryArgs }
                },
                json: true,
                url: proposerUrl,
                timeout: timeout
            }, 
            (err, res, body) => {
                if (!err && res.statusCode == 200) {
                    resolve(body);
                } else {
                    resolve({ "status": "UNKNOWN", "details": [{"id": "ERRNO001"}]});
                }
            }
        );
    });
}