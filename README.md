Gryadka is a minimalistic master-master replicated consistent key-value storage based on the [CASPaxos](https://arxiv.org/abs/1802.07000) protocol. It uses Redis as a backend and makes multiple Redis instances work as a whole tolerating up to F failures out of 2F+1 nodes.

Its core has less than 500 lines of code but provides full featured Paxos implementation supporting such advance features as cluster membership change (ability to add/remove nodes to a cluster) and distinguished proposer optimization (using one round trip to change a value instead of two).

#### Is it correct?

Yes, it seems so.

The protocol has formal proof (see the CASPaxos paper) and TLA+ models independently written by Greg Rogers and Tobias Schottdorf:

  * [A TLA+ specification for Gryadka](https://medium.com/@grogepodge/tla-specification-for-gryadka-c80cd625944e)
  * [Paxos on Steroids and a Crash Course in TLA+](https://tschottdorf.github.io/single-decree-paxos-tla-compare-and-swap)

Moreover, the implementation was heavily tested with fault injections on the network layer.

#### Is it production ready?

No, it's an educational project and it was never intended to be deployed in production. The goal of the project is to build master-master replicated consistent key-value storage as simple as possible.

Even though Gryadka is an educational project, its operational characteristics surpass established databases (see [the comparison](https://github.com/rystsov/perseus)).

# API

Gryadka's core interface is a `changeQuery` function which takes three arguments:
  
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
    return this.paxos.changeQuery(key, x => x==null ? { ver: 0, val: null} : x, x => x);
  }
  write(key, ver, val) {
    return this.paxos.changeQuery(key, x => {
      if (x.ver != ver) throw new Error();
      return { ver: ver+1, val: val };
    }, x => x);
  }
}
```

## Examples

Please see the https://github.com/gryadka/js-example repository for an example of web api built on top of Gryadka.

# Cluster membership change

Please find information on membership change in the CASPaxos paper. The procedure was tested in the following tests:

|Name | Description|
|---|---|
|c2p2k2.a3.a4 | tests a process of migration from 3 acceptors to 4 acceptors |
|c2p2k2.flux | tests a process of continuous extending/shrinking a cluster between 3 and 4 acceptors |

# Tests

Testing is done by mocking the network layer and checking consistency invariants during various 
network fault injections such as message dropping and message reordering.

Each test scenario uses seed-able randomization so all test's random decisions are determined by 
its initial value (seed) and user can replay any test and expect the same outcome.

### Invariants

The following situation is one of the examples of a consistency violation:

1. Alice reads a value
2. Alice tells Bob the observed value via an out of the system channel (a rumor)
3. Bob reads a value but the system returns a value which is older than the rumor 

It gives a hint how to check linearizability:

* Tests check a system similar to CASKeyValue
* All clients are homogeneous and execute the following loop
  1. Read a value
  2. Change it
  3. Write it back
* Clients run in the same process concurrently and spread rumors instantly after each read or write operation
* Once a client observed a value (through the read or write operation) she checks that it's equal or newer than the one known through rumors on the moment the operation started

This procedure already helped to find a couple of consistency bugs so it works :)  

In order to avoid a degradation of the consistency test to `return true;` there is the `losing/c2p2k1.i` test which
tests the consistency check on an a priory inconsistent Paxos configuration (three acceptors with quorums of size 1).  

### How to run consistency tests:

Prerequisites: node-nightly installed globally, see https://www.npmjs.com/package/node-nightly for details

1. Clone this repo
2. cd gryadka
3. npm install
4. ./bin/run-consistency-tests.sh all void seed1

Instead of "void" one can use "record" to record all events fired in the system during a simulation after it. Another alternative is "replay" - it executes the tests and compares current events with previously written events (it was useful to check determinism of a simulation).

It takes time to execute all test cases so run-consistency-tests.sh also supports execution of a particular test case: just replace "all" with the test's name. Run ./bin/run-consistency-tests.sh without arguments to see which tests are supported.