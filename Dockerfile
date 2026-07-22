FROM node:22-alpine

WORKDIR /app

ARG APP_BUILD_BRANCH=unknown
ENV NODE_ENV=production
ENV PORT=3000
ENV APP_BUILD_BRANCH=${APP_BUILD_BRANCH}

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY server.js ./
COPY public ./public
COPY scripts ./scripts
RUN npm run sync:manifest-version

EXPOSE 3000

CMD ["node", "server.js"]
