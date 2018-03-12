#!/bin/bash

docker rm gryadka_emulation
docker run --name=gryadka_emulation -i -v $(pwd)/gryadka:/gryadka -t gryadka_node /gryadka/bin/run-consistency-tests.sh all void seed14
