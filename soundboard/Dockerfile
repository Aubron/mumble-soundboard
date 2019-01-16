FROM node:8
ENV NODE_ENV production
RUN apt-get update
RUN apt-get install ffmpeg -y
WORKDIR /usr/src/app
COPY package*.json ./
RUN yarn install
COPY . .
CMD ["yarn","prod"]