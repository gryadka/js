#!/bin/bash

find src/paxos \
\
  | egrep "\.(js|lua)$" \
\
  | xargs wc -l \
\
  | grep total | awk '{print "Paxos:    " $1}'


find tests -name *.js  \
\
  | xargs wc -l \
\
  | grep total | awk '{print "Tests:   " $1}'