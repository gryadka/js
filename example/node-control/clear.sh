#!/bin/bash

docker rm gryadka_control
docker image rm gryadka_control
rm -rf lib-http-proposer-api
rm -rf core
rm -rf control/node_modules
rm control/package-lock.json