# Example of HTTP key-value storage based on Gryadka

This is an example of how to build a simple HTTP key-value storage based on Gryadka and to perform reconfiguration.

The system consists of 7 nodes:

  * Three acceptors (redis).
  * Two proposers (with http interface).
  * A client node which hosts three coroutines continuously picking a random proposer and incrementing a random key by reading a value first and then performing compare and set.
  * A control node with scripts for manually changing the number of acceptors from three to four without interrupting the clients.

## How to run the cluster and change its configuration

Open terminal with this project, `cd http-example` and `./build-run.sh` to run acceptors and proposers.

Proposer are not configured so any operation will fail. Let's configure them to use one acceptor. Open a new terminal window, `cd http-example/node-control` and execute:

```
./run-control.sh add-accept all acceptor-1:6379 1
./run-control.sh add-prepare all acceptor-1:6379 1
```

After this point we can start a client and then perform live reconfiguration. Open a new terminal window, `cd http-example/node-control` and `./run-client.sh` to run the three clients. You'll see the following output:

```
# proposers: 3
# keys: 9
# clients: 3
0       [0-0-0 0]       [0-0-0 0]       [0-0-0 0]
1       [36-23-18 0]    [36-18-15 0]    [43-24-23 0]
2       [45-23-22 0]    [45-29-26 0]    [41-28-22 0]
3       [43-30-27 0]    [52-28-22 0]    [50-29-26 0]
4       [43-24-20 0]    [52-25-25 0]    [48-29-27 0]
5       [51-30-26 0]    [45-26-20 0]    [48-26-26 0]
```

The first column is the n-th second since the start. The last three columns correspond to the clients. Each has the number of:
  * `read` attempts per current second
  * successful `reads`
  * successful `writes`
  * network errors

The funnel structure tells about the high number of failures caused by contention since clients choose proposers randomly.

Let's perform live reconfiguration and make proposer use all three acceptors. Switch to the control window and execute:

```
./run-control.sh add-accept all acceptor-2:6379 2
./run-control.sh rescan acceptor-1:6379,acceptor-2:6379 2
./run-control.sh add-prepare all acceptor-2:6379 2
./run-control.sh add-accept all acceptor-3:6379 2
./run-control.sh add-prepare all acceptor-3:6379 2
```

As a result we increased replication factor and resiliency. Now let's make proposers to use only one acceptor again (shrink the cluster):

```
./run-control.sh rm-accept all acceptor-3:6379 2
./run-control.sh rm-prepare all acceptor-3:6379 2
./run-control.sh rescan acceptor-1:6379,acceptor-2:6379 2
./run-control.sh rm-accept all acceptor-2:6379 1
./run-control.sh rm-prepare all acceptor-2:6379 1
./wipe-acceptor-2.sh
./wipe-acceptor-3.sh
```

The last two commands remove all data from acceptor-2 and acceptor-3. It's necessary if we want to reintroduce acceptor-2 and acceptor-3 back to the cluster.

N.B. each command is idempotent so we can retry it until it succeds and only then move to the next command.

For details on reconfiguration see the CASPaxos paper.