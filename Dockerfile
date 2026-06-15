FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Expose port if your app runs a server
EXPOSE 4002

# Start the application
CMD ["node", "server.js"]