Gryadka is a minimalistic layer on top of multiple instances of Redis working as a reliable master-master replicated 
consistent key/value storage. When Gryadka uses 2N+1 Redis nodes it can continue working even when up to N nodes become 
unavailable.

Its core has less than 500 lines of code but provides full featured Paxos implementation supporting such advance 
features as cluster membership change (ability to add/remove nodes to a cluster) and distinguished proposer optimization 
(using one round trip to change a value instead of two).

# Why

Paxos is a master-master replication protocol. Its inventor, Leslie Lamport wrote that 
["it is among the simplest and most obvious of distributed algorithms"](http://research.microsoft.com/en-us/um/people/lamport/pubs/paxos-simple.pdf)
but many who tried to implement it run into troubles:

  * ["building a production system turned out to be a non-trivial task for a variety of reasons"](https://www.cs.utexas.edu/users/lorenzo/corsi/cs380d/papers/paper2-1.pdf)
  * ["Paxos is by no means a simple protocol, even though it is based on relatively simple invariants"](http://www.cs.cornell.edu/courses/cs7412/2011sp/paxos.pdf)
  * ["we found few people who were comfortable with Paxos, even among seasoned researchers"](https://raft.github.io/raft.pdf)

This dissonance made me wonder so I challenged myself to write a simple Paxos implementation. I took lines of code as
a measure of simplicity and set a limit of 500 lines of code.

# FAQ

#### How does it differ from Redis Cluster?

[Redis Cluster](https://redis.io/topics/cluster-spec) is responsible for sharding and replication while Gryadka pushed sharding to a layer above and does only replication.

For replication Redis Cluster uses master-slave model with asynchronous replication so it's unable to guarantee
consistency. [Redis's docs](https://redis.io/topics/cluster-tutorial) say: "Redis Cluster is not able to guarantee 
strong consistency. In practical terms this means that under certain conditions it is possible that Redis Cluster will 
lose writes that were acknowledged by the system to the client.".

Gryadka uses Paxos based master-master replication so lost writes and other consistency issues are impossible by 
design.

#### Is it production ready?

No, it's an educational project and was never intended to be in production. It was created:

  * to practice and hone skills in distributed systems
  * to demonstrate that Paxos isn't as complex as it is known to be  

Nevertheless Gryadka supports cluster membership change and distinguished proposer optimization so it has all
the necessary production features.

#### Does it support storages other than Redis?

No, the size of a pluggable storage system would have been of the same magnitude as the Gryadka's current
Paxos implementation so only Redis is supported.

The good news is that the size of the code is tiny so it should be easy to read, understand and rewrite
it for any storage of your choice.

#### I heard that Raft is simpler than Paxos, why don't you use it?

Raft is a protocol for building replicated consistent persistent append-only log. Paxos has several flavors. 
Multi-decree Paxos does the same as Raft (log), but Single-decree Paxos replicates atomic variable.

Yes, Raft looks simpler than Multi-decree Paxos, but Single-decree Paxos is simpler than Raft because
with Paxos all the updates happen in-place and you don't need to implement log truncation and snapshotting.

Of course replicated log is a more powerful data structure than replicated variable, but for a lot of cases it's 
enough the latter. For example, a key-value storage can be build just with a set of replicated variables.

#### Why did I choose JavaScript and Redis?

Gryadka is an educational project so I chose 
[the most popular language](https://github.com/blog/2047-language-trends-on-github) on GitHub and 
[the most popular key/value storage](http://db-engines.com/en/ranking/key-value+store) (according to db-engines).

# Design principle

The main principle of Gryadka is **to get rid of everything that isn't essential to the replication and everything that can be 
implemented on the client side**. A lot of things which look essential to replication actually can be implemented as 
an above layer. Among them are transactions, sharding, consistent backup and leader election.  

#### Transactions

There are a lot of papers, articles and libraries covering or building client-side transactions supporting isolation 
levels from Read Committed to Serializable. Among them are:

 * ["Large-scale Incremental Processing Using Distributed Transactions and Notifications"](https://research.google.com/pubs/pub36726.html) by Google
 * ["Scalable Atomic Visibility with RAMP Transactions"](http://www.bailis.org/papers/ramp-sigmod2014.pdf) by UC Berkeley and University of Sydney
 * ["Transactions for Amazon DynamoDB"](https://github.com/awslabs/dynamodb-transactions) by Amazon
 * ["Omid: Transactional Support for HBase"](https://github.com/yahoo/omid) by Yahoo/Apache
 * ["How CockroachDB Does Distributed, Atomic Transactions"](https://www.cockroachlabs.com/blog/how-cockroachdb-distributes-atomic-transactions/) by CockroachLabs
 * ["Perform Two Phase Commit"](https://docs.mongodb.com/manual/tutorial/perform-two-phase-commits/) by MongoDB

It might also be useful to take a look at ["Visualization of RAMP transactions"](http://rystsov.info/2016/04/07/ramp.html) and
["Visualization of serializable cross shard client-side transactions"](http://rystsov.info/2016/03/02/cross-shard-txs.html). 

#### Consistent backups

An ability to make consistent backups (aka point-in-time backup, consistent cut/snapshots) looks like an essential 
feature for a consistent storage but many major storages don't support it.

["MongoDB's docs"](https://docs.mongodb.com/manual/tutorial/backup-sharded-cluster-with-filesystem-snapshots/): "On a running production system, you can only capture an approximation of point-in-time snapshot."

["Cassandra's docs"](http://docs.datastax.com/en/archived/cassandra/3.x/cassandra/operations/opsAboutSnapshots.html): "To take a global snapshot, run the nodetool snapshot command using a parallel ssh utility ... This provides an eventually consistent backup. Although no one node is guaranteed to be consistent with its replica nodes at the time a snapshot is taken"

["Riak's docs"](http://docs.basho.com/riak/kv/2.2.0/using/cluster-operations/backing-up/): "backups can become slightly inconsistent from node to node"

Hopefully consistent backups can be implemented on the client side. If a system is based on the actor model and a key/value 
storage is only used to keep actor's state then it's possible to use [Lai–Yang's algorithm](https://www.cs.uic.edu/~ajayk/DCS-Book)
or [Mattern's algorithm](https://www.cs.uic.edu/~ajayk/DCS-Book) to make consistent snapshots.  

Alternatively if the system isn't based on the actor model then it's possible to integrate snapshotting with
transactions by denying transactions if its keys were backed up in different snapshots.

#### Leader election

Naive Paxos implementation uses two round trips between acceptors and proposers to commit a value.
Of course a proposer can piggy back the next 'prepare' message on the current 'accept' message.
It effectively reduces the number of round trips from two to one if the next update will be issued
from the same proposer (otherwise nothing bad happens because Paxos holds consistency in the presence
of concurrent proposers).  

So the problem of leader election reduces to the problem of how to land most of the user updates to the same
node. It can be solved on the above layer with [Microsoft Orleans](https://github.com/dotnet/orleans), 
[Uber RingPop](https://github.com/uber/ringpop-node) or any other consistent hashing routing approach.

#### Sharding

Sharding is a way to split big key space into disjoint smaller key spaces and host each of them on their own
instance of the system in order to overcome the size limitations. The procedure of splitting and joining
key spaces should not affect correctness of the concurrent key updates operations.

The straightforward approach is to use transactions to simultaneously put a tombstone to the big key space instance of
the system and to init smaller key space with the tombed value. Once all the keys are migrated and all the clients
switch to the new key/space topology then it's safe to drop the tombstoned key/values from the original key space.

So sharding can be also pushed to the client side.

# API

Gryadka's core interface is trivial. It's a `changeQuery` function which takes three arguments:
  
  * a `key`
  * a `change` function
  * a `query` function

Internally `changeQuery` gets a value associated with the `key`, applies `change` to calculate a new value, 
saves it back and returns `query` applied to that new value.

The pseudo-code:

```javascript
class Paxos {
  constuctor() {
    this.storage = ...;
  }
  changeQuery(key, change, query) {
    const value = change(this.storage.get(key));
    this.storage.set(key, value);
    return query(value);
  }
}
```

By choosing the appropriate change/query functions it's possible to customize Gryadka to fulfill different tasks. 
A "last write win" key/value could be implemented as:

```javascript
class LWWKeyValue {
  constuctor(paxos) {
    this.paxos = paxos;
  }
  read(key) {
    return this.paxos.changeQuery(key, x => x, x => x);
  }
  write(key, value) {
    return this.paxos.changeQuery(key, x => value, x => x);
  }
}
```

A key/value storage with compare-and-set support may look like:

```javascript
class CASKeyValue {
  constuctor(paxos) {
    this.paxos = paxos;
  }
  read(key) {
    return this.paxos.changeQuery(key, x => x==null ? { ver: 0, val: null}, x => x);
  }
  write(key, ver, val) {
    return this.paxos.changeQuery(key, x => {
      if (x.ver != ver) throw new Error();
      return { ver: ver+1, val: val };
    }, x => x);
  }
}
```

## Network

Gryadka exposes its api via an HTTP interface. It's problematic to pass functions via the network therefore
users should put functions on the server and pass names of the functions instead of them. See the `src/webapi/mutators`
folder.

The system is distributed and homogeneous so it has several endpoints and all of them are equal. A user can choose any of them
to invoke the `changeQuery` api; however if all the requests affecting the same `key` land on the same endpoint then
the distinguished proposer optimization kicks in and the requests run twice faster.

Gryadka is based on remote interactions. Remote interactions significantly differ from local - instead of having two possible 
outcomes of an operation it has three: 'success', 'failure' and 'unknown'. The latter may be returned when an operation timeouts
and the true outcome is unknown.

The result of `changeQuery` reflects all those possibilities.

# Consistency

A consistent system is one that does not contain a contradiction. Contradictions happen when a system breaks its
promises. Different storages provide different promises so there are different types of consistency:
eventual, weak, causal, strong and others.

Gryadka supports linearizability (a promise) so it is a strongly consistent data storage (of course if it holds 
its promise).

Intuitively, linearizability is very close to thread safety: a system of a linearizable key/value storage and its
clients behaves the same way as a thread safe hashtable and a set of threads working with it. The only difference is
that a linearizable key/value storage usually is replicated and tolerates network issues and node's crushes without
violating the consistency guarantees.

It isn't easy to keep promises, for example Kyle Kingsbury demonstrates in [his research](https://aphyr.com/tags/jepsen) 
that many commercial data storages had consistency issues, among them were: 
[VoltDB](https://aphyr.com/posts/331-jepsen-voltdb-6-3), 
[Cassandra](https://aphyr.com/posts/294-jepsen-cassandra),
[MongoDB](https://aphyr.com/posts/322-jepsen-mongodb-stale-reads) and others.

This is the reason why Gryadka was built with consistency testing in mind. **Its code to test ratio is 1:5** so
for 500 lines of Paxos there are 2500 lines of tests.

## Theory

Tests can prove that a program has errors but they can't guarantee correctness. The way to go is to write a program
based on a validated model. One can use a formal specification language like TLA+ to describe a model 
and then check it with a model checker, alternatively an algorithm (a model) can be proved by hand using logic, 
induction and other math arsenal.

Gryadka uses Single-decree Paxos (Synod) to implement a rewritable register. A write once variant of Synod is 
proved in [Paxos Made Simple](http://research.microsoft.com/en-us/um/people/lamport/pubs/paxos-simple.pdf) paper.
The rewritable variant is its extension, I bet there is a paper describing it but I failed to find it so I 
practiced logic and proved it in this [post](http://rystsov.info/2015/09/16/how-paxos-works.html).

## Cluster membership change

The [proof easily extends](http://rystsov.info/2015/12/30/read-write-quorums.html) to support read and write quorums 
of different size which is consistent with the result of 
[Flexible Paxos: Quorum intersection revisited](https://arxiv.org/abs/1608.06696). This idea can be 
combined with [Raft's joint consensus](https://raft.github.io/slides/raftuserstudy2013.pdf) to demonstrate that 
a [simple sequence of steps changes the size of a cluster](http://rystsov.info/2016/01/05/raft-paxos.html) without violation of
consistency.

## Simulated network, mocked Redis

Testing is done by mocking the network layer and checking consistency invariants during various 
network invasions such as message dropping and reordering.

Each test scenario uses seed-able randomization so all tests' random decisions are determined by 
its initial value (seed) and user can replay any test and expect the same outcome. 

#### How to run consistency tests:

Prerequisites: nodejs

1. Clone this repo
2. cd gryadka
3. npm install
4. ./run-consistenty-check.sh all void seed1

Instead of "void" one can use "record" to record all events fired in the system during a simulation after it. Another
alternative is "replay" - it executes the tests and compares current events with previously written events (it was
useful to check determinism of a simulation).

It takes time to execute all test cases so run-consistenty-check.sh also supports execution of a particular test case: just
replace "all" with the test's name. Run ./run-consistenty-check.sh without arguments to see which tests are supported.

## End-to-end testing

Prerequisites: redis, nodejs

#### Membership change

Please follow the link to see 
[a screencast about membership change from 3 to 4 acceptors](https://asciinema.org/a/7ewvgpfkyh8190q1ifumauekm). 
It includes:

  * generation of Redis's and Gryadka's configs from a compact description
  * starting the system
  * using test console to run clients, monitor thier progress and detecting consistency violation
  * stopping acceptors to simulate crashes
  * on the fly membership change from 3 to 4 acceptors


<a href="https://asciinema.org/a/7ewvgpfkyh8190q1ifumauekm" target="_blank"><img src="/img/a3a4.png" width="979"/></a>

#### Manual quering Gryadka with cURL

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
