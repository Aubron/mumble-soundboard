FROM node:8
ENV NODE_ENV production
WORKDIR /usr/src/app
COPY package*.json ./
RUN yarn install
COPY . .
CMD ["yarn","start"]