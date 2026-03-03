FROM node:22-alpine AS base
WORKDIR /app
ENV npm_config_nodedir=/usr/local
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm install

FROM base AS build
COPY . .
RUN npm run build:ssr

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
CMD ["npm", "run", "start"]
