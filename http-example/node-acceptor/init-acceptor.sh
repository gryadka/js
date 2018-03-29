#!/bin/bash

sleep 5s

set -e

pushd /gryadka

redis-cli -h 127.0.0.1 -p 6379 SCRIPT LOAD "$(cat /gryadka/gryadka-redis/src/lua/accept.lua)" > accept.hash
redis-cli -h 127.0.0.1 -p 6379 SCRIPT LOAD "$(cat /gryadka/gryadka-redis/src/lua/prepare.lua)" > prepare.hash
redis-cli -h 127.0.0.1 -p 6379 SET accept $(cat accept.hash)
redis-cli -h 127.0.0.1 -p 6379 SET prepare $(cat prepare.hash)

rm accept.hash
rm prepare.hash

popd