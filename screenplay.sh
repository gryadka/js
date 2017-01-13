
exit 0

#### 1
./demo/step1.sh
./bin/pseudo-distribute.sh etc/a3a4.json


#### 2
./demo/step2.sh
tmux
ctrl-b , acceptor
make grid: xx
           xx
ctrl-b c
ctrl-b , proposers
make grid: x
           x
ctrl-b c
ctrl-b , test console

ctrl-b c
ctrl-b , comments

#### 3
./demo/step3.sh

# on acceptors
redis-server deployment/a0/redis.conf
redis-server deployment/a1/redis.conf
redis-server deployment/a2/redis.conf

#### 4
./demo/step4.sh

# on proposers
./bin/gryadka.sh deployment/proposers/p0.json
./bin/gryadka.sh deployment/proposers/p1.json
   
#### 5
./demo/step5.sh

# on test console
./run-system-check.sh etc/a3a4.json

clients: c0,c1
make c0,c1 use p0,p1
start c0,c1

#### 6
./demo/step6.sh

# mess with acceptors
# check progress

#### 6
./demo/step6.sh
./demo/step7.sh
./demo/step8.sh
./demo/step9.sh

# on acceptors
redis-server deployment/a3/redis.conf

# on proposers
./bin/gryadka.sh deployment/proposers/p2.json
./bin/gryadka.sh deployment/proposers/p3.json

#### 10
./demo/step10.sh

# on test console
clients: c2,c3
make c2,c3 use p2,p3
start c2,c3
stop c0,c1

#### 11
./demo/step11.sh

# on proposers
# stop p0 & p1 proposers

#### 12
./demo/step12.sh

# on comments

./bin/keys-dumper.sh etc/a3a4.json a0 >> keys1
./bin/keys-dumper.sh etc/a3a4.json a1 >> keys1
./bin/keys-dumper.sh etc/a3a4.json a2 >> keys1
cat keys1 | sort | uniq > keys2
cat keys2

#### 13
./demo/step13.sh

./bin/keys-syncer.sh deployment/proposers/s0.json keys2

#### 14
./demo/step14.sh

# on proposers
./bin/gryadka.sh deployment/proposers/p4.json
./bin/gryadka.sh deployment/proposers/p5.json

#### 15
./demo/step15.sh

# on test console
clients: c4,c5
make c4,c5 use p4,p5
start c4,c5
stop c2,c3

#### 16
./demo/step16.sh

# on proposers
# stopping p2 & p3
