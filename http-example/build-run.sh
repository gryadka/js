#!/bin/bash

set -e

rm -rf node-full/gryadka-core
rm -rf node-full/gryadka-redis
rm -rf node-acceptor/gryadka-redis

cp -r ../gryadka-core node-full/gryadka-core
cp -r ../gryadka-redis node-full/gryadka-redis
cp -r ../gryadka-redis node-acceptor/gryadka-redis

docker-compose up