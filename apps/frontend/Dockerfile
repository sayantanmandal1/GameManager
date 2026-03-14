FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/shared/package.json ./packages/shared/
RUN npm install --workspace=apps/frontend --workspace=packages/shared

# Copy source
COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/frontend/ ./apps/frontend/

# Build shared package first, then frontend
WORKDIR /app/packages/shared
RUN npm run build
WORKDIR /app/apps/frontend
RUN npm run build

# Production image — preserve workspace layout for shared package symlink
FROM node:20-alpine
WORKDIR /app
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages/shared/dist ./packages/shared/dist
COPY --from=base /app/packages/shared/package.json ./packages/shared/
COPY --from=base /app/apps/frontend/.next ./apps/frontend/.next
COPY --from=base /app/apps/frontend/public ./apps/frontend/public
COPY --from=base /app/apps/frontend/package.json ./apps/frontend/
WORKDIR /app/apps/frontend
EXPOSE 3000
CMD ["npm", "start"]