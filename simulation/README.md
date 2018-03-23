# Testing in simulated environment

Testing is done by mocking the network layer and checking consistency invariants during various network fault injections such as message dropping and message reordering.

Each test scenario uses seed-able randomization, so all test's random decisions are determined by its initial value (seed) and the user can replay any test and expect the same outcome.

### How to run consistency tests:

Prerequisites: Docker

1. Clone this repo - `git clone https://github.com/gryadka/js.git gryadka`
2. `cd gryadka/simulation`
3. Run tests - `./build-run.sh all void seed14`


### Invariants

The following situation is one of the examples of a consistency violation:

1. Alice reads a value
2. Alice tells Bob the observed value via an out of the system channel (a rumor)
3. Bob reads a value, but the system returns a value which is older than the rumor 

It gives a hint how to check linearizability:

* Tests check a system similar to CASKeyValue
* All clients are homogeneous and execute the following loop
  1. Read a value
  2. Change it
  3. Write it back
* Clients run in the same process concurrently and spread rumors instantly after each read or write operation
* Once a client observed a value (through the read or write operation) she checks that it's equal or newer than the one known through rumors on the moment the operation started

This procedure already helped to find a couple of consistency bugs, so it works :)  

To avoid degradation of the consistency test to `return true;` there is the `losing/c2p2k1.i` test which
tests the consistency check on a priory inconsistent Paxos configuration (three acceptors with quorums of size 1).