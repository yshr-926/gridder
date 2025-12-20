# Gridder Collaboration Server Dockerfile
# Multi-stage build for optimized production image

# =============================================================================
# Stage 1: Build
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# =============================================================================
# Stage 2: Production
# =============================================================================
FROM node:20-alpine AS production

# Add non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --production && \
    npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Set ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose ports
EXPOSE 3001 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3002/health || exit 1

# Start server
CMD ["npm", "start"]
