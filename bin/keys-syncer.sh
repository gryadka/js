#!/bin/bash

# args example: deployment/proposers/s0.json keys.txt
node-nightly src/paxos/membership/keys-syncer.js $1 $2
