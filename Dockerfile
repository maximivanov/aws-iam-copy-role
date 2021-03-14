FROM node:14

WORKDIR /var/downloads

# https://github.com/aws/aws-cli/issues/1957
RUN apt-get update -y && apt-get install groff -y

RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \
    unzip awscliv2.zip && \
    ./aws/install && \
    rm -rf awscliv2.zip aws

WORKDIR /var/app

COPY copy-role.js package.json ./