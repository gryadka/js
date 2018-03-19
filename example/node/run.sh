#!/bin/bash

set -e

rm -rf core

cp -r ../../core core

if ! docker images | grep gryadka_node; then
  docker build -t="gryadka_node" .
fi

mkdir -p logs

docker run -i --name=gryadka_node \
  -v $(pwd)/logs:/gryadka/logs \
  --tmpfs /gryadka/mem \
  -t gryadka_node

docker rm gryadka_node

rm -rf core