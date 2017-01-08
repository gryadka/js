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

#### How to run consistency tests:

Prerequisites: redis, nodejs

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

## System Testing

Prerequisites: redis, nodejs

#### Staring a system and using curl to put a value

1. Clone this repo
2. cd gryadka
3. npm install
4. ./bin/pseudo-distribute.sh etc/p2a3.json
5. redis-server deployment/a0/redis.conf &
6. redis-server deployment/a1/redis.conf &
7. redis-server deployment/a2/redis.conf &
8. ./bin/gryadka.sh deployment/proposers/p0.json &
9. Test a sample key/value storage
    * curl -w "\n" -H "Content-Type: application/json" -X POST -d '{"key": "answer", "change": {"name": "kv-init","args": "unknown"},"query": {"name": "kv-read","args": null}}' http://localhost:8079/change
    * curl -w "\n" -H "Content-Type: application/json" -X POST -d '{"key": "answer", "change": {"name": "kv-update","args": {"version":0, "value": 42}},"query": {"name": "kv-read","args": null}}' http://localhost:8079/change
    * curl -w "\n" -H "Content-Type: application/json" -X POST -d '{"key": "answer", "change": {"name": "kv-id","args": null},"query": {"name": "kv-read","args": null}}' http://localhost:8079/change
    * curl -w "\n" -H "Content-Type: application/json" -X POST -d '{"key": "answer", "change": {"name": "kv-reset","args": "to pass butter"},"query": {"name": "kv-read","args": null}}' http://localhost:8079/change

#### Membership change

1. ./bin/pseudo-distribute.sh etc/a3a4.json
2. redis-server deployment/a0/redis.conf &
3. redis-server deployment/a1/redis.conf &
4. redis-server deployment/a2/redis.conf &
5. ./bin/gryadka.sh deployment/proposers/p0.json &
6. ./bin/gryadka.sh deployment/proposers/p1.json &
7. [dashboard] open a new tab and run: ./run-system-check.sh etc/a3a4.json
8. [dashboard]: "clients: c0,c1"
9. [dashboard]: "make c0,c1 use p0,p1"
10. [dashboard]: "start c0,c1"
11. ./bin/gryadka.sh deployment/proposers/p2.json &
12. ./bin/gryadka.sh deployment/proposers/p3.json &
13. [dashboard]: "clients: c2,c3"
14. [dashboard]: "make c2,c3 use p2,p3"
15. [dashboard]: "start c2,c3"
16. [dashboard]: "stop c0,c1"
17. kill p0 & p1 proposers
18. ./bin/keys-dumper.sh etc/a3a4.json a0 >> keys1
19. ./bin/keys-dumper.sh etc/a3a4.json a1 >> keys1
20. ./bin/keys-dumper.sh etc/a3a4.json a2 >> keys1
21. cat keys1 | sort | uniq > keys2
22. ./bin/keys-syncer.sh deployment/proposers/s0.json keys2
23. ./bin/gryadka.sh deployment/proposers/p4.json &
24. ./bin/gryadka.sh deployment/proposers/p5.json &
25. [dashboard]: "clients: c4,c5"
26. [dashboard]: "make c4,c5 use p4,p5"
27. [dashboard]: "start c4,c5"
28. [dashboard]: "stop c2,c3"
29. kill p2 & p3 proposers

