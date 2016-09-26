   npm install -g babel-cli

0. Run Redis

   redis-server /usr/local/etc/redis.conf

1. load prepare script into redis:

    redis-cli SCRIPT LOAD "$(cat src/acceptor/prepare.lua)"
    redis-cli SCRIPT LOAD "$(cat src/acceptor/accept.lua)"
    redis-cli SCRIPT LOAD "$(cat src/proposer/fastforward.lua)"

2. write down the sha1 hash

   3f7fb0e76e084ab7dd8e938763a8205d1b661eb6

3.  create 

4. 
     babel src/proposer/Proposer.es6 -o src/proposer/Proposer.js

curl -w "\n" -H "Content-Type: application/json" -X POST -d '{"key":"lisa1a","tick":[1,1,2,1]}'
curl -w "\n" -H "Content-Type: application/json" -X POST -d '{"key":"lisa1a","tick":[1,1,2,0]}' http://localhost:1991/prepare
curl -w "\n" -H "Content-Type: application/json" -X POST -d '{"key":"lisa1a","tick":[1,2,2,1]}' http://localhost:1991/prepare
curl -w "\n" -H "Content-Type: application/json" -X POST -d '{"key":"lisa1a","tick":[1,2,2,1],"state":"I love Lisa"}' http://localhost:1991/accept


curl -w "\n" -H "Content-Type: application/json" -X POST -d '{"key": "lisa1a", "change": {"name": "id-change","args": null},"query": {"name": "id-query","args": null}}' http://localhost:1992/change

node proposer/api.js settings/proposer1.json



TODO:

DOCS:

1. Specification of the proposer API
2. Introductary:
     - what? consistent distributed key/value storage on top of redis. 