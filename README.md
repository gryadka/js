> THE SYSTEM IS UNDER CONSTRUCTION

Gryadka is a minimalistic layer on top of Redis turning it into a distributed consistent 
key/value storage (CP). Its core has less than 500 lines of code but provides full featured 
Paxos implementation supporting such advance features as cluster membership change and 
leader election.

## Testing

Testing is done by:
* mocking the network layer and checking consistency invariants during various network 
  invasions like message dropping and reordering
* using dcm-oss/blockade to testing the whole system during network partitions

### Mocked network

cpunit tests mock network, simulate network anomalies and checks that consistency holds. Each 
test uses seed-able randomization. It means that all test's random decisions are determined by 
its initial value (seed) so user can replay any test in order to debug an issue. 

#### How to run a test:

1. Clone this repo
2. cd gryadka
3. npm install
4. ./tests/cpunit.sh record network_shuffling seed1
5. ./tests/cpunit.sh replay network_shuffling seed1

The 4th command (record) runs the network_shuffling test using seed1 as the seed and record 
all network messages to tests/network_shuffling/network.log.

The 5th command (replay) also runs the network_shuffling test but beside that it
checks that the observed network messages match the recorded history to checks that the test's
behavior indeed depends only on the seed parameter.

Run ./tests/cpunit.sh without arguments to see which tests are supported.