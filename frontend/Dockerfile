FROM node:20-alpine AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_WS_URL=http://localhost:8000
ARG NEXT_PUBLIC_TURN_URLS
ARG NEXT_PUBLIC_TURN_USERNAME
ARG NEXT_PUBLIC_TURN_CREDENTIAL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_TURN_URLS=$NEXT_PUBLIC_TURN_URLS
ENV NEXT_PUBLIC_TURN_USERNAME=$NEXT_PUBLIC_TURN_USERNAME
ENV NEXT_PUBLIC_TURN_CREDENTIAL=$NEXT_PUBLIC_TURN_CREDENTIAL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --chown=node:node --from=builder /app/.next ./.next
COPY --chown=node:node --from=builder /app/public ./public
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/package.json ./
COPY --chown=node:node --from=builder /app/next.config.js ./

EXPOSE 3000
USER node
CMD ["npm", "start"]