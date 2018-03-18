FROM ubuntu:17.10
LABEL maintainer="Denis Rystsov <rystsov.denis@gmail.com>"
RUN apt-get update -y --fix-missing
RUN apt-get install -y wget supervisor iptables
RUN apt-get install -y iputils-ping vim tmux less curl --fix-missing
RUN apt-get install -y redis-server
RUN /bin/bash -c "curl -sL https://deb.nodesource.com/setup_8.x | bash -"
RUN apt-get install -y nodejs
RUN mkdir -p /gryadka
WORKDIR /gryadka
COPY redis.conf /gryadka/redis.conf
CMD /bin/bash
