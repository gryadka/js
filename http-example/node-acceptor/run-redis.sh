#!/bin/bash

me=$(hostname)

redis-server /gryadka/redis.conf > /gryadka/logs/$me.redis.log
