const {change, registerChange, UnexpectedError, UnexpectedResponseError, PrepareError, CommitError, UnknownChangeFunctionError, ConcurrentRequestError, UpdateError} = require("lib-http-proposer-api");

(async () => {
    const endpoints = [
        "http://acceptor-proposer-1:8080",
        "http://acceptor-proposer-2:8080",
        "http://acceptor-proposer-3:8080"
    ];

    const keys = ["key1", "key2", "key3", "key4", "key5", "key6", "key4", "key5", "key6"];

    console.info("# proposers: " + endpoints.length);
    console.info("# keys: " + keys.length);
    console.info("# clients: " + 3);
    
    const statA = initStat();
    const statB = initStat();
    const statC = initStat();

    try {
        const context = { isActive: true };
        dumpProgress(context, [statA, statB, statC]);
        const taskA = readWriteLoop(endpoints, keys, statA);
        const taskB = readWriteLoop(endpoints, keys, statB);
        const taskC = readWriteLoop(endpoints, keys, statC);
        await taskA;
        await taskB;
        await taskC;
        context.isActive = false;
        console.info("Client A");
        console.info(statA);
        console.info("Client B");
        console.info(statB);
        console.info("Client C");
        console.info(statC);
    } catch (e) {
        console.info(e);
    }
})();

async function readWriteLoop(endpoints, keys, stat) {
    while (true) {
        const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
        const key = keys[Math.floor(Math.random() * keys.length)];
        
        stat.attempts++;
        try {
            const stored = await read(endpoint, key, stat.read);
            const updated = await write(endpoint, key, stored.ver, stored.val + 2, stat.write);
            if (updated.ver == stored.ver) {
                stat.casmiss++;
            } else {
                stat.success++;
            }
        } catch(e) {
            if (e instanceof PrepareError) {
                continue;
            } else if (e instanceof CommitError) {
                continue;
            } else if (e instanceof ConcurrentRequestError) {
                continue;
            }
            throw e;
        }
    }
}

async function read(endpoint, key, stat) {
    let commit = 1;
    let prepare = 1;
    while (true) {
        try {
            stat.attempts++;
            const result = await change(endpoint, "read", key, null);
            stat.success++;
            return result;
        } catch (e1) {
            if (e1 instanceof UnknownChangeFunctionError) {
                await registerChange(endpoint, "read", "params => x => x == null ? {ver:0, val:0} : x");
                continue;
            } else if (e1 instanceof PrepareError) {
                stat.prepare.all++;
                if (prepare > 0) {
                    stat.prepare.mitigated++;
                    prepare--;
                    continue;
                }
            } else if (e1 instanceof CommitError) {
                stat.commit.all++;
                if (commit > 0) {
                    stat.commit.mitigated++;
                    commit--;
                    continue;
                }
            } else if (e1 instanceof ConcurrentRequestError) {
                stat.concurrency++;
            }
            throw e1;
        }
    }
}

async function write(endpoint, key, ver, val, stat) {
    while (true) {
        try {
            stat.attempts++;
            const result = await change(endpoint, "write", key, {ver: ver, val: val});
            stat.success++;
            return result;
        } catch (e1) {
            if (e1 instanceof UnknownChangeFunctionError) {
                await registerChange(
                    endpoint, 
                    "write", 
                    "y => x => x.ver == y.ver ? { ver: y.ver + 1, val: y.val } : x"
                );
                continue;
            } else if (e1 instanceof ConcurrentRequestError) {
                stat.concurrency++;
            }
            throw e1;
        }
    }
}

function initStat() {
    return {
        attempts: 0,
        success: 0,
        casmiss: 0,
        read: {
            attempts: 0,
            success: 0,
            prepare: {
                all: 0,
                mitigated: 0
            },
            commit: {
                all: 0,
                mitigated: 0
            },
            concurrency: 0
        }, 
        write: {
            attempts: 0,
            success: 0,
            concurrency: 0
        }
    };
}

async function dumpProgress(context, stats) {
    console.info("#time [read attempts - read success (write attempts) - write success] x number of clients");
    const last = [];
    for (let i=0;i<stats.length;i++) {
        last[i] = JSON.parse(JSON.stringify(stats[i]));
    }
    let tick = 0;
    while (context.isActive) {
        let line = "" + tick;
        for (let i=0;i<stats.length;i++) {
            const ts = stats[i].success - last[i].success;
            const ta = stats[i].attempts - last[i].attempts;
            const rs = stats[i].read.success - last[i].read.success;
            const ra = stats[i].read.attempts - last[i].read.attempts;
            const ws = stats[i].write.success - last[i].write.success;
            const wa = stats[i].write.attempts - last[i].write.attempts;

            last[i] = JSON.parse(JSON.stringify(stats[i]));
            line += `\t[${ra}-${rs}-${ws}]`;
        }
        console.info(line);
        await new Promise(resolve => {
            setTimeout(() => resolve(null), 1000);
        });
        tick+=1;
    }
}