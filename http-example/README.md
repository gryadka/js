# Example of HTTP key-value storage based on Gryadka

The system consists of 6 nodes:

  * Three of them are full nodes and host two processes each, an acceptor and a proposer.
  * A client node which hosts three coroutines continuously picking a random proposer and incrementing a random key by reading a value first and then performing compare and set.
  * A control node with scripts for manually changing the number of acceptors from three to four without interrupting the clients
  * A standing by acceptor node.

## How to run the cluster and change its configuration

Open terminal with this project, `cd example` and `./build-run.sh` to run the full nodes and a standby acceptor.

Open a new terminal window, `cd example/node-clients` and `./build-run.sh` to run the three clients. You'll see the following output:

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

Open a third window and `cd example/node-control`. Now we'll perform an extension of the cluster. Please see the CASPaxos paper and sources for the details. It makes sense to monitor client's output to make sure that there is no impact.

1. `./build-run.sh accept` - adds the fourth acceptor to the accept list and adjusts accept quorum from 2 to 3
2. `./build-run.sh rescan` - rereads every key.
3. `./build-run.sh prepare` - adds the fourth acceptor to the prepare list and adjusts prepare quorum from 2 to 3

After the 3rd step, the cluster membership change is over.