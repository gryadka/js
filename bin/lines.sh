#!/bin/bash

find . \
\
  | grep -v git \
  | grep -v node_modules \
  | grep -v tests \
  | grep -v gryadka \
  | egrep "\.(js|lua)$" \
\
  | xargs wc -l \
\
  | grep total | awk '{print $1}'


find . \
\
  | grep -v git \
  | grep -v node_modules \
  | grep -v tests \
  | egrep "\.(js|lua)$" \
\
  | xargs wc -l \
\
  | grep total | awk '{print $1}'


find tests \
\
  | egrep "\.js$" \
\
  | xargs wc -l \
\
  | grep total | awk '{print $1}'