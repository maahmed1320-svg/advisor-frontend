FROM node:20-alpine AS build

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install all dependencies (including devDependencies like vite)
RUN npm ci

# Copy the rest of the project
COPY . .

# --- FIX: Ensure node_modules binaries are executable ---
RUN chmod +x node_modules/.bin/vite

# Now run the build
RUN npm run build

# --- Production stage ---
FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist /app/dist

EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]