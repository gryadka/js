#!/bin/bash

rm -rf node-proposer/gryadka-core
rm -rf node-proposer/gryadka-redis
rm -rf node-acceptor/gryadka-redis
rm -rf logs

docker rm acceptor-1 acceptor-2 acceptor-3 proposer-1 proposer-2

docker image rm httpexample_proposer1
docker image rm httpexample_proposer2
docker image rm httpexample_acceptor1
docker image rm httpexample_acceptor2
docker image rm httpexample_acceptor3