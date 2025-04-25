FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies with verbose logging
RUN npm ci --verbose

# Copy tsconfig and other config files
COPY tsconfig*.json ./
COPY eslint.config.mjs ./

# Copy source code
COPY . .

# Build the application with verbose output
RUN npm run build || (echo "Build failed. Checking for errors:" && ls -la && cat tsconfig.json && exit 1)

# Verify build output
RUN ls -la dist || (echo "dist directory not found or empty" && exit 1)

# Remove development dependencies
RUN npm prune --production

# Production image
FROM node:18-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/src/main"]