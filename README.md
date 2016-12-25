> THE SYSTEM IS UNDER CONSTRUCTION

Gryadka is a minimalistic layer on top of Redis turning it into a distributed consistent 
key/value storage (CP). Its core has less than 500 lines of code but provides full featured 
Paxos implementation supporting such advance features as cluster membership change and 
distinguished proposer optimization.

## Consistency (linearizability) testing

Testing is done by mocking the network layer and checking consistency invariants during various 
network invasions like message dropping and reordering.

**TODO:** use dcm-oss/blockade or jepsen to test against real deployment

Each test scenario uses seed-able randomization. It means that all test's random decisions are determined by 
its initial value (seed) so user can replay any test in order to debug an issue. 

#### How to run a test:

1. Clone this repo
2. cd gryadka
3. npm install
4. ./run-consistenty-check.sh partitioning/c2p2k2 record seed1
5. ./run-consistenty-check.sh partitioning/c2p2k2 replay seed1

The 4th command (record) runs the partitioning/c2p2k2 test using seed1 as a seed and records 
all messages between mocked acceptors and proposers to the tests/consistency/scenarios/partitioning/c2p2k2.log log.

The 5th command (replay) also runs the same test and 
validates that the observed messages match the recorded history.
It is usefull to check if a test's behavior depends only on a seed parameter.

Use 'all' instead of 'partitioning/c2p2k2' to run all tests. You can use 'void' instead of 'record' or 'replay'
if you don't want to log the messages.

Run ./run-consistenty-check.sh without arguments to see which tests are supported.