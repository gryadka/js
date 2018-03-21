#!/bin/bash

set -e

rm -rf full-node/core

cp -r ../core full-node/core

docker-compose up