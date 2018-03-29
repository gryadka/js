#!/bin/bash

rm -rf node-full/gryadka-core
rm -rf node-full/gryadka-redis
rm -rf node-acceptor/gryadka-redis
rm -rf logs

docker rm acceptor-proposer-1 acceptor-proposer-2 acceptor-proposer-3 acceptor-4

docker image rm httpexample_gryadka1
docker image rm httpexample_gryadka2
docker image rm httpexample_gryadka3
docker image rm httpexample_gryadka4