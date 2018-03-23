#!/bin/bash

set -e

redis-cli -h 127.0.0.1 -p 6379 SCRIPT LOAD "$(cat /gryadka/http-proposer/node_modules/gryadka/src/redisAcceptor/lua/accept.lua)" > accept.hash
redis-cli -h 127.0.0.1 -p 6379 SCRIPT LOAD "$(cat /gryadka/http-proposer/node_modules/gryadka/src/redisAcceptor/lua/prepare.lua)" > prepare.hash
redis-cli -h 127.0.0.1 -p 6379 SET accept $(cat accept.hash)
redis-cli -h 127.0.0.1 -p 6379 SET prepare $(cat prepare.hash)

rm accept.hash
rm prepare.hash

nodejs /gryadka/http-proposer/test.js "/gryadka/http-proposer/conf" $(hostname)