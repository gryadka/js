#!/bin/bash

set -e

ln -s ../lib-http-proposer-api || true

if ! docker images | grep gryadka_clients; then
  docker build -t="gryadka_clients" .
fi

if [[ ! -d clients/node_modules ]]; then
  docker rm gryadka_clients || true
  docker run -i --name=gryadka_clients \
  -v $(pwd)/clients:/gryadka/clients \
  -v $(pwd)/../lib-http-proposer-api:/gryadka/lib-http-proposer-api \
  --network=httpexample_gryadkanet \
  -t gryadka_clients \
  /gryadka/clients/bin/install-npm.sh
fi

docker rm gryadka_clients || true
docker run -i --name=gryadka_clients \
  -v $(pwd)/clients:/gryadka/clients \
  -v $(pwd)/../lib-http-proposer-api:/gryadka/lib-http-proposer-api \
  --network=httpexample_gryadkanet \
  -t gryadka_clients
