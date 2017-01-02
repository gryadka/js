#!/bin/bash

set -e

./node_modules/babel-cli/bin/babel-node.js src/gryadka/start-service.js $1
