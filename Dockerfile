FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY server.js ./
COPY public ./public
COPY scripts ./scripts
RUN npm run sync:manifest-version

EXPOSE 3000

CMD ["node", "server.js"]
