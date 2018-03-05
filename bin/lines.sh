#!/bin/bash

find src \
\
  | egrep "\.(js|lua)$" \
\
  | xargs wc -l \
\
  | grep total | awk '{print "Paxos:    " $1}'

find tests  \
\
  | egrep "\.js$" \
\
  | xargs wc -l \
\
  | grep total | awk '{print "Tests:   " $1}'