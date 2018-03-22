#!/bin/bash

set -e

ln -s ../lib-http-proposer-api || true

if ! docker images | grep gryadka_control; then
  docker build -t="gryadka_control" .
fi

docker run -i --name=gryadka_control \
  --network=example_gryadkanet \
  -v $(pwd)/control:/gryadka/control \
  -v $(pwd)/../lib-http-proposer-api:/gryadka/lib-http-proposer-api \
  -t gryadka_control \
  /bin/bash

docker rm gryadka_control