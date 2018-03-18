#!/bin/bash

set -e

if ! docker images | grep gryadka_node; then
  docker build -t="gryadka_emulation" .
fi

if [ ! -d $(pwd)/node_modules ]; then
  docker run -i --name=gryadka_emulation \
    -v $(pwd)/../core:/gryadka/core \
    -v $(pwd):/gryadka/emulation \
    -t gryadka_emulation \
    /gryadka/emulation/bin/npm-install.sh
  
  docker rm gryadka_emulation
fi

docker run -i --name=gryadka_emulation \
  -v $(pwd)/../core:/gryadka/core \
  -v $(pwd):/gryadka/emulation \
  -t gryadka_emulation \
  nodejs /gryadka/emulation/src/runner.js "$@" || true

docker rm gryadka_emulation