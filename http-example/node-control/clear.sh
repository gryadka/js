#!/bin/bash

docker rm gryadka_control
docker rm gryadka_client
docker image rm gryadka_control
rm -rf control/node_modules
rm -rf clients/node_modules
rm control/package-lock.json
rm clients/package-lock.json