#!/bin/bash

docker run -i -t --tmpfs /gryadka/mem -v $(pwd)/../gryadka:/gryadka/src rystsov/gryadka