#!/bin/bash

docker rm gryadka_clients
docker image rm gryadka_clients
rm -rf lib-http-proposer-api
rm -rf clients/node_modules
rm clients/package-lock.json