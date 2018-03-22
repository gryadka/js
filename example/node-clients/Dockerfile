FROM ubuntu:17.10
LABEL maintainer="Denis Rystsov <rystsov.denis@gmail.com>"
RUN apt-get update -y --fix-missing
RUN apt-get install -y wget supervisor iptables
RUN apt-get install -y iputils-ping vim tmux less curl --fix-missing
RUN /bin/bash -c "curl -sL https://deb.nodesource.com/setup_8.x | bash -"
RUN apt-get install -y nodejs
WORKDIR /gryadka
COPY lib-http-proposer-api /gryadka/lib-http-proposer-api
COPY clients /gryadka/clients
WORKDIR /gryadka/clients
RUN npm install
CMD nodejs /gryadka/clients/src/test.js
