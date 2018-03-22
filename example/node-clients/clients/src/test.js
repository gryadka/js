const {change, registerChange, UnexpectedError, UnexpectedResponseError, PrepareError, CommitError, UnknownChangeFunctionError, ConcurrentRequestError, UpdateError} = require("lib-http-proposer-api");

(async () => {
    const hosts = [
        {
            endpoint: "http://acceptor-proposer-1:8080",
            isAlive: true,
            lastCheck: 0
        },
        {
            endpoint: "http://acceptor-proposer-2:8080",
            isAlive: true,
            lastCheck: 0
        },
        {
            endpoint: "http://acceptor-proposer-3:8080",
            isAlive: true,
            lastCheck: 0
        }
    ];

    const keys = ["key1", "key2", "key3", "key4", "key5", "key6", "key4", "key5", "key6"];

    console.info("# proposers: " + hosts.length);
    console.info("# keys: " + keys.length);
    console.info("# clients: " + 3);
    
    const statA = initStat("#1");
    const statB = initStat("#2");
    const statC = initStat("#3");

    try {
        const context = { isActive: true };
        dumpProgress(context, [statA, statB, statC]);
        const taskA = readWriteLoop(hosts, keys, statA);
        const taskB = readWriteLoop(hosts, keys, statB);
        const taskC = readWriteLoop(hosts, keys, statC);
        await taskA;
        await taskB;
        await taskC;
    } catch (e) {
        console.info(e);
    }
})();

async function readWriteLoop(hosts, keys, stat) {
    while (true) {
        const host = hosts[Math.floor(Math.random() * hosts.length)];
        const key = keys[Math.floor(Math.random() * keys.length)];

        if (!host.isAlive && (stat.time - host.lastCheck) < 10) {
            if (hosts.some(x => x.isAlive)) {
                continue;
            }
            await new Promise(resolve => {
                setTimeout(() => resolve(null), 1000);
            });
            continue;
        }

        host.isActive = true;
        host.lastCheck = stat.time;

        stat.iteration.time = stat.time;
        stat.iteration.endpoint = host.endpoint;
        
        stat.attempts++;
        try {
            const stored = await read(host.endpoint, key, stat.read);
            const updated = await write(host.endpoint, key, stored.ver, stored.val + 2, stat.write);
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
            } else if ((e instanceof UnexpectedError) && e.err.code == "ECONNRESET") {
                host.isAlive = false;
                stat.connectivity_issues++;
                continue;
            } else if ((e instanceof UnexpectedError) && e.err.code == "ENOTFOUND") {
                host.isAlive = false;
                stat.connectivity_issues++;
                continue;
            } else if ((e instanceof UnexpectedError) && e.err.code == "ECONNREFUSED") {
                host.isAlive = false;
                stat.connectivity_issues++;
                continue;
            } else if ((e instanceof UnexpectedError) && e.err.code == "ETIMEDOUT") {
                host.isAlive = false;
                stat.connectivity_issues++;
                continue;
            } else if ((e instanceof UnexpectedError)) {
                console.info("#################");
                console.info(e);
                throw e;
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

function initStat(name) {
    return {
        iteration: {
            time: 0,
            endpoint: ""
        },
        attempts: 0,
        success: 0,
        casmiss: 0,
        name: name,
        time: 0,
        connectivity_issues: 0,
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
    try {
        console.info("#time [read attempts - read success (write attempts) - write success connectivity issues] x number of clients");
        const last = [];
        for (let i=0;i<stats.length;i++) {
            last[i] = JSON.parse(JSON.stringify(stats[i]));
        }
        let time = 0;
        while (context.isActive) {
            for (let i=0;i<stats.length;i++) {
                stats[i].time = time;
            }
            let line = "" + time;
            for (let i=0;i<stats.length;i++) {
                const ra = stats[i].read.attempts - last[i].read.attempts;
                const rs = stats[i].read.success - last[i].read.success;
                const ws = stats[i].write.success - last[i].write.success;

                const err = stats[i].connectivity_issues - last[i].connectivity_issues;

                line += `\t[${ra}-${rs}-${ws} ${err}]`;
            }
            for (let i=0;i<stats.length;i++) {
                last[i] = JSON.parse(JSON.stringify(stats[i]));
            }
            console.info(line);
            await new Promise(resolve => {
                setTimeout(() => resolve(null), 1000);
            });
            time+=1;
        }
    } catch (e) {
        console.info(e);
    }
}