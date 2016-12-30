#!/bin/bash

set -e

rm -rf deployment/*

mkdir deployment/proposers

./node_modules/babel-cli/bin/babel-node.js src/deploy/deploy.js $1 acceptors | xargs -n1 -I '{}' mkdir "deployment/{}"
./node_modules/babel-cli/bin/babel-node.js src/deploy/deploy.js $1 redis etc/redis.mustache "$(pwd)"
./node_modules/babel-cli/bin/babel-node.js src/deploy/deploy.js $1 load-lua | xargs -L1 ./src/deploy/load-lua.sh
./node_modules/babel-cli/bin/babel-node.js src/deploy/deploy.js $1 proposer "$(pwd)"