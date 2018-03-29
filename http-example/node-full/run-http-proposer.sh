#!/bin/bash

set -e

nodejs /gryadka/http-proposer/test.js "/gryadka/http-proposer/conf" $(hostname) > /gryadka/logs/proposer.log