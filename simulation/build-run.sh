#!/bin/bash

set -e

if ! docker images | grep gryadka_simulation; then
  docker build -t="gryadka_simulation" .
fi

if [ ! -d $(pwd)/node_modules ]; then
  docker run -i --name=gryadka_simulation \
    -v $(pwd)/../gryadka-core:/gryadka/gryadka-core \
    -v $(pwd):/gryadka/simulation \
    -t gryadka_simulation \
    /gryadka/simulation/bin/npm-install.sh
  
  docker rm gryadka_simulation
fi

docker run -i --name=gryadka_simulation \
  -v $(pwd)/../gryadka-core:/gryadka/gryadka-core \
  -v $(pwd):/gryadka/simulation \
  -t gryadka_simulation \
  nodejs /gryadka/simulation/src/runner.js "$@" || true

docker rm gryadka_simulation