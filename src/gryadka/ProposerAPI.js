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
                    resolve(validate({ proposersReturn: body}));
                } else {
                    //console.info(err);
                    //console.info(res);
                    console.info(res.statusCode);
                    console.info(body);
                    resolve({ "status": "UNKNOWN", "details": [{"id": "ERRNO001"}]});
                }
            }
        );
    });
}

const statuses = ["OK", "NO", "UNKNOWN"];

function validate({proposersReturn}) {
    if (!statuses.includes(proposersReturn.status)) {
        throw new Error();
    }
    return {
        "status": proposersReturn.status,
        "details": proposersReturn.details
    };
}