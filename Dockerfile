FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json* ./
COPY backend/package.json backend/package-lock.json* ./backend/
COPY frontend/package.json frontend/package-lock.json* ./frontend/

# Install dependencies for root, backend, and frontend
RUN npm install

# Copy source files
COPY . .

# Build both backend and frontend static assets
RUN npm run build

# Default environment configuration
ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_PATH=./data/shoppilot.db

EXPOSE 3001

CMD ["npm", "--prefix", "backend", "start"]

