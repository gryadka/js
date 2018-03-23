Gryadka is a minimalistic master-master replicated consistent key-value storage based on the [CASPaxos](https://arxiv.org/abs/1802.07000) protocol. It uses Redis as a backend and makes multiple Redis instances work as a whole tolerating up to F failures out of 2F+1 nodes.

Its core has less than 500 lines of code but provides full-featured Paxos implementation supporting such advanced features as cluster membership change (ability to add/remove nodes to a cluster) and distinguished proposer optimization (using one round trip to change a value instead of two).

#### Is it correct?

Yes, the protocol has formal proof (see the CASPaxos paper) and TLA+ models independently written by Greg Rogers and Tobias Schottdorf:

  * [A TLA+ specification for Gryadka](https://medium.com/@grogepodge/tla-specification-for-gryadka-c80cd625944e)
  * [Paxos on Steroids and a Crash Course in TLA+](https://tschottdorf.github.io/single-decree-paxos-tla-compare-and-swap)

Moreover, the implementation was heavily tested with fault injections on the network layer.

#### Is it production ready?

No, it's an educational project, and it was never intended to be deployed in production. The goal of the project is to build master-master replicated consistent key-value storage as simple as possible.

Even though Gryadka is an educational project, its operational characteristics surpass established databases (see [the comparison](https://github.com/rystsov/perseus)).

# API

Gryadka's core interface is a `change` function which takes two arguments:
  
  * a `key`
  * a `update` function

`change` gets a value associated with the `key`, applies `update` to calculate a new value, saves and returns it.

The pseudo-code:

```javascript
class Paxos {
  constuctor() {
    this.storage = ...;
  }
  change(key, update) {
    const value = update(this.storage.get(key));
    this.storage.set(key, value);
    return value;
  }
}
```

By choosing the appropriate update functions, it's possible to customize Gryadka to fulfill different tasks. A "last write win" key/value could be implemented as:

```javascript
class LWWKeyValue {
  constuctor(paxos) {
    this.paxos = paxos;
  }
  read(key) {
    return this.paxos.change(key, x => x);
  }
  write(key, value) {
    return this.paxos.change(key, x => value);
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
    return this.paxos.change(key, x => x==null ? { ver: 0, val: null} : x);
  }
  write(key, ver, val) {
    return this.paxos.change(key, x => {
      if (x.ver != ver) throw new Error();
      return { ver: ver+1, val: val };
    });
  }
}
```

# Dockerized example of cluster membership change

Please see https://github.com/gryadka/js/tree/master/example for an example of:

  * Dockerized Gryadka-based cluster
  * Using Gryadka to build a HTTP key-value storage
  * Cluster membership change

Additional information about cluster membership change is in the CASPaxos paper and in the simulation tests (see `2p2k2.a3.a4` and `c2p2k2.flux` tests):

# Tests

Testing is done by mocking the network layer and checking consistency invariants during various network fault injections such as message dropping and message reordering.

See https://github.com/gryadka/js/tree/master/simulation for more information.