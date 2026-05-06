FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
COPY scripts ./scripts
RUN npm ci --omit=dev
RUN npm run sync:manifest-version

COPY server.js ./
COPY public ./public

EXPOSE 3000

CMD ["node", "server.js"]
