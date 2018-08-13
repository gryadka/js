#!/bin/bash

set -e

. build.sh

docker rm gryadka_client || true
docker run -i --name=gryadka_client \
  --network=httpexample_gryadkanet \
  -v $(pwd)/control:/gryadka/control \
  -v $(pwd)/clients:/gryadka/clients \
  -v $(pwd)/lib-http-proposer-api:/gryadka/lib-http-proposer-api \
  -t gryadka_control \
  nodejs /gryadka/clients/src/test.js