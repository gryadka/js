#!/bin/bash

docker rm gryadka_emulation
docker build -t="gryadka_node" .
