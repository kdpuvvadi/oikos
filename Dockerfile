FROM node:22-alpine AS frontend

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY index.html vite.config.js jsconfig.json ./
COPY public ./public
COPY src ./src
COPY scripts ./scripts

ARG APP_BUILD_BRANCH=unknown
# Empty = same-origin (PocketBase serves API + pb_public together).
ARG VITE_PB_URL=
ENV APP_BUILD_BRANCH=${APP_BUILD_BRANCH}
ENV VITE_PB_URL=${VITE_PB_URL}

RUN npm run sync:manifest-version
RUN npm run build

FROM ghcr.io/kdpuvvadi/pocketbase:latest

LABEL org.opencontainers.image.title="Oikos"
LABEL org.opencontainers.image.description="Simple Expenses Management System"
LABEL org.opencontainers.image.licenses="MIT"

RUN mkdir -p /usr/src/app/pb_data /usr/src/app/pb_public /usr/src/app/pb_hooks

WORKDIR /usr/src/app

COPY pb_hooks/ /usr/src/app/pb_hooks/
COPY --from=frontend /app/dist /usr/src/app/pb_public

EXPOSE 8090

VOLUME ["/usr/src/app/pb_data"]

ENTRYPOINT ["/usr/src/app/pocketbase", "serve", "--http", "0.0.0.0:8090", "--dir", "/usr/src/app/pb_data", "--publicDir", "/usr/src/app/pb_public", "--hooksDir", "/usr/src/app/pb_hooks"]
