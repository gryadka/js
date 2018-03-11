const {log, msg} = require("./Logging");
const {ProposerError, Proposer} = require("../../../src/Proposer");

const typedRespondAbstractFactory = respondType => details => ({ "status": respondType, "details": details });

const OK = typedRespondAbstractFactory("OK");
const NO = typedRespondAbstractFactory("NO");
const UNKNOWN = typedRespondAbstractFactory("UNKNOWN");

class ProposerAdapter {
    constructor(cache, prepare, accept) {
        this.core = new Proposer(cache, prepare, accept);
    }

    async change(key, update, extra) {
        try {
            return OK(await this.core.change(key, x => {
                var [val, err] = update(x);
                if (err != null) {
                    throw err;
                } else {
                    return val;
                }
            }, extra));
        } catch (e) {
            if (e instanceof ProposerError) {
                if (e.code == "ConcurrentRequestError") {
                    return NO(log().append(msg("ERRNO002")).core);
                }
                if (e.code == "PrepareError") {
                    return NO(log().append(msg("ERRNO009")).append(msg("ERRNO003")).core);
                }
                if (e.code == "CommitError") {
                    return UNKNOWN(log().append(msg("ERRNO009")).append(msg("ERRNO004")).core);
                }
                if (e.code == "UpdateError") {
                    return NO(e.err.append(msg("ERRNO005")).core);
                }
                throw e;
            } else {
                throw e;
            }
        }
    }
}

exports.ProposerAdapter = ProposerAdapter;