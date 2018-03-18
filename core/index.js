const {AcceptorClient} = require("./src/redisAcceptor/AcceptorClient");
const {Proposer, ProposerError} = require("./src/Proposer");
const {BallotNumber} = require("./src/BallotNumber");

exports.AcceptorClient = AcceptorClient;
exports.Proposer = Proposer;
exports.ProposerError = ProposerError;
exports.BallotNumber = BallotNumber;
