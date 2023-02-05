FROM node:slim AS builder
RUN apt-get update || : && apt-get install -y python3 build-essential
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .
WORKDIR /usr/src/app/nosh3-client
RUN npm ci
RUN npm run build

FROM node:alpine
LABEL Maintainer Michael Shihjay Chen <shihjay2@gmail.com>
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/nosh3-client/dist ./nosh3-client/dist
COPY --from=builder /usr/src/app/*.mjs /usr/src/app/jsconfig.json ./
COPY --from=builder /usr/src/app/assets ./assets
COPY --from=builder /usr/src/app/node_modules ./node_modules
EXPOSE 4000
CMD ["node", "index.mjs"]