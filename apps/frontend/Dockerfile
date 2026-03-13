FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/shared/package.json ./packages/shared/
RUN npm install --workspace=apps/frontend --workspace=packages/shared

# Copy source
COPY packages/shared/ ./packages/shared/
COPY apps/frontend/ ./apps/frontend/

# Build
WORKDIR /app/apps/frontend
RUN npm run build

# Production image
FROM node:20-alpine
WORKDIR /app
COPY --from=base /app/apps/frontend/.next ./.next
COPY --from=base /app/apps/frontend/public ./public
COPY --from=base /app/apps/frontend/package.json ./
COPY --from=base /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "start"]
