#!/bin/bash

find core/src \
\
  | egrep "\.(js|lua)$" \
\
  | xargs wc -l \
\
  | grep total | awk '{print "Paxos:    " $1}'

find tests/src  \
\
  | egrep "\.js$" \
\
  | xargs wc -l \
\
  | grep total | awk '{print "Tests:   " $1}'