#!/bin/bash

find gryadka-core/src \
\
  | egrep "\.(js|lua)$" \
\
  | xargs wc -l \
\
  | grep total | awk '{print "gryadka-core:    " $1}'

find gryadka-redis/src \
\
  | egrep "\.(js|lua)$" \
\
  | xargs wc -l \
\
  | grep total | awk '{print "gryadka-redis:    " $1}'

find simulation/src  \
\
  | egrep "\.js$" \
\
  | xargs wc -l \
\
  | grep total | awk '{print "Tests:   " $1}'