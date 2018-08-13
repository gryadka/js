#!/bin/bash

set -e

. build.sh

docker rm gryadka_control || true
docker run -i --name=gryadka_control \
  --network=httpexample_gryadkanet \
  -v $(pwd)/control:/gryadka/control \
  -v $(pwd)/clients:/gryadka/clients \
  -v $(pwd)/lib-http-proposer-api:/gryadka/lib-http-proposer-api \
  -t gryadka_control \
  nodejs /gryadka/control/src/test.js $@