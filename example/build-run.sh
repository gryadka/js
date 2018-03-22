#!/bin/bash

set -e

rm -rf node-full/core

cp -r ../core node-full/core

docker-compose up