FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/
RUN npm install --workspace=apps/backend --workspace=packages/shared

# Copy source
COPY packages/shared/ ./packages/shared/
COPY apps/backend/ ./apps/backend/

# Build
WORKDIR /app/apps/backend
RUN npm run build

# Production image
FROM node:20-alpine
WORKDIR /app
COPY --from=base /app/apps/backend/dist ./dist
COPY --from=base /app/apps/backend/package.json ./
COPY --from=base /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/main"]
