> THE SYSTEM IS UNDER CONSTRUCTION

Gryadka is a minimalistic layer on top of multiple instances of Redis working as a distributed consistent 
key/value storage (CP). Its core has less than 500 lines of code but provides full featured 
Paxos implementation supporting such advance features as cluster membership change and 
distinguished proposer optimization.

# FAQ

#### Is it a production ready?
#### I heard that Raft is simpler than Paxos, why didn't you use it?

# Goal

Paxos is a master-master replication protocol. Its inventor, Leslie Lamport wrote that "it is among the simplest 
and most obvious of distributed algorithms" [1] but many who tried to implement it run into troubles:

  * "building a production system turned out to be a non-trivial task for a variety of reasons" [2]
  * "Paxos is by no means a simple protocol, even though it is based on relatively simple invariants" [3]
  * "we found few people who were comfortable with Paxos, even among seasoned researchers" [4]

This dissonance made me wonder so I challenged myself to write a simple Paxos implementation. I took lines of code as
a measure of simplicity and set a limit of 500 lines in order to avoid creating a monster of several thousand lines.

# Principles

The main principle of Gryadka is to get rid of everything if it can be implemented on the client side.

#### Transactions
#### Consistent backups
#### Leader election 

# API

# Consistency

## Simulated network testing

Testing is done by mocking the network layer and checking consistency invariants during various 
network invasions like message dropping and reordering.

Each test scenario uses seed-able randomization. It means that all test's random decisions are determined by 
its initial value (seed) so user can replay any test in order to debug an issue. 

#### How to run consistency tests:

Prerequisites: nodejs

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

## End-to-end testing

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
11. redis-server deployment/a3/redis.conf &
12. ./bin/gryadka.sh deployment/proposers/p2.json &
13. ./bin/gryadka.sh deployment/proposers/p3.json &
14. [dashboard]: "clients: c2,c3"
15. [dashboard]: "make c2,c3 use p2,p3"
16. [dashboard]: "start c2,c3"
17. [dashboard]: "stop c0,c1"
18. kill p0 & p1 proposers
19. ./bin/keys-dumper.sh etc/a3a4.json a0 >> keys1
20. ./bin/keys-dumper.sh etc/a3a4.json a1 >> keys1
21. ./bin/keys-dumper.sh etc/a3a4.json a2 >> keys1
22. cat keys1 | sort | uniq > keys2
23. ./bin/keys-syncer.sh deployment/proposers/s0.json keys2
24. ./bin/gryadka.sh deployment/proposers/p4.json &
25. ./bin/gryadka.sh deployment/proposers/p5.json &
26. [dashboard]: "clients: c4,c5"
27. [dashboard]: "make c4,c5 use p4,p5"
28. [dashboard]: "start c4,c5"
29. [dashboard]: "stop c2,c3"
30. kill p2 & p3 proposers

# Links

[1] "Paxos Made Simple" http://research.microsoft.com/en-us/um/people/lamport/pubs/paxos-simple.pdf
[2] "Paxos Made Live - An Engineering Perspective" https://www.cs.utexas.edu/users/lorenzo/corsi/cs380d/papers/paper2-1.pdf
[3] "Paxos Made Moderately Complex" http://www.cs.cornell.edu/courses/cs7412/2011sp/paxos.pdf
[4] "In Search of an Understandable Consensus Algorithm" https://raft.github.io/raft.pdf
[5] "Consensus, Made Thrive" https://www.cockroachlabs.com/blog/consensus-made-thrive/