#!/bin/bash

set -e

./node_modules/babel-cli/bin/babel-node.js src/webapi/start-service.js $1
