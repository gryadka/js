#!/bin/bash

# deployment/proposers/s0.json keys.txt
./node_modules/babel-cli/bin/babel-node.js src/mvpaxos/membership/keys-syncer.js $1 $2
