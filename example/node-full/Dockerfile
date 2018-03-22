FROM ubuntu:17.10
LABEL maintainer="Denis Rystsov <rystsov.denis@gmail.com>"
RUN apt-get update -y --fix-missing
RUN apt-get install -y wget supervisor iptables
RUN apt-get install -y iputils-ping vim tmux less curl --fix-missing
RUN apt-get install -y redis-server
RUN /bin/bash -c "curl -sL https://deb.nodesource.com/setup_8.x | bash -"
RUN apt-get install -y nodejs
WORKDIR /gryadka
COPY core /gryadka/core
COPY http-proposer /gryadka/http-proposer
WORKDIR /gryadka/core
RUN npm install
WORKDIR /gryadka/http-proposer
RUN npm install
WORKDIR /gryadka
COPY redis.conf /gryadka/redis.conf
COPY run-redis.sh /gryadka/run-redis.sh
COPY run-http-proposer.sh /gryadka/run-http-proposer.sh
COPY node.conf /etc/supervisor/conf.d/node.conf
CMD /usr/bin/supervisord -n
