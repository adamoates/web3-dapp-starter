FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Expose backend port
EXPOSE 5000

# Start the app
CMD ["node", "src/index.js"]