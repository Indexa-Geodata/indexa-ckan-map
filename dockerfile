FROM node:19.9.0
RUN mkdir /code
WORKDIR /code
COPY . .