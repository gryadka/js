#!/bin/bash

rm -rf full-node/core
rm -rf logs

docker rm acceptor-proposer-1 acceptor-proposer-2 acceptor-proposer-3

docker image rm example_gryadka1
docker image rm example_gryadka2
docker image rm example_gryadka3