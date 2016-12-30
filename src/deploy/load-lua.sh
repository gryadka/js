#!/bin/bash

set -e

redis-server deployment/$1/redis.conf &
PID=$!
# I don't have an excuse for sleep
sleep 1
redis-cli -p $2 SCRIPT LOAD "$(cat src/mvpaxos/lua/accept.lua)" > deployment/$1/accept.hash
redis-cli -p $2 SCRIPT LOAD "$(cat src/mvpaxos/lua/prepare.lua)" > deployment/$1/prepare.hash
kill $PID
