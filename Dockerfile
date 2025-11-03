FROM node:20-alpine

LABEL maintainer="Suhail Taj Shaik"
LABEL description="NodeJsVoip - WebSocket-based VOIP application"

# Create app directory
WORKDIR /opt/app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Bundle app source
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /opt/app

# Switch to non-root user
USER nodejs

# Environment variables with defaults
ENV SSL_PORT=443 \
    HTTP_PORT=80 \
    NODE_ENV=production \
    PRIVATE_KEY_PATH=./cert/key.pem \
    CERTIFICATE_PATH=./cert/cert.pem \
    CORS_ORIGIN=* \
    PING_TIMEOUT=60000 \
    PING_INTERVAL=25000 \
    DEBUG=false

# Expose ports
EXPOSE ${HTTP_PORT} ${SSL_PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:${HTTP_PORT}/', (res) => { process.exit(res.statusCode === 301 ? 0 : 1); })"

# Start the application
CMD [ "npm", "start" ]