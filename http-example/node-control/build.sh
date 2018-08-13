#!/bin/bash

set -e

if ! docker images | grep gryadka_control; then
  docker build -t="gryadka_control" .
fi

if [[ ! -d control/node_modules ]]; then
  docker rm gryadka_control || true
  docker run -i --name=gryadka_control \
    -v $(pwd)/control:/gryadka/control \
    -v $(pwd)/lib-http-proposer-api:/gryadka/lib-http-proposer-api \
    --network=httpexample_gryadkanet \
    -t gryadka_control \
    /gryadka/control/bin/install-npm.sh
fi

if [[ ! -d clients/node_modules ]]; then
  docker rm gryadka_control || true
  docker run -i --name=gryadka_control \
    -v $(pwd)/clients:/gryadka/clients \
    -v $(pwd)/lib-http-proposer-api:/gryadka/lib-http-proposer-api \
    --network=httpexample_gryadkanet \
    -t gryadka_control \
    /gryadka/clients/bin/install-npm.sh
fi