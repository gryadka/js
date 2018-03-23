#!/bin/bash

set -e

ln -s ../lib-http-proposer-api || true
ln -s ../../core || true

if ! docker images | grep gryadka_control; then
  docker build -t="gryadka_control" .
fi

if [[ ! -d control/node_modules ]]; then
  docker rm gryadka_control || true
  docker run -i --name=gryadka_control \
  -v $(pwd)/control:/gryadka/control \
  -v $(pwd)/../lib-http-proposer-api:/gryadka/lib-http-proposer-api \
  -v $(pwd)/../../core:/gryadka/core \
  --network=example_gryadkanet \
  -t gryadka_control \
  /gryadka/control/bin/install-npm.sh
fi

docker rm gryadka_control || true
docker run -i --name=gryadka_control \
  --network=example_gryadkanet \
  -v $(pwd)/control:/gryadka/control \
  -v $(pwd)/../lib-http-proposer-api:/gryadka/lib-http-proposer-api \
  -v $(pwd)/../../core:/gryadka/core \
  -t gryadka_control nodejs /gryadka/control/src/test.js $@