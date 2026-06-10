FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Copy the rest of your project
COPY . .

# --- ADD THIS LINE ---
# This grants execute permissions to all binaries in node_modules/.bin
RUN chmod -R +x node_modules/.bin/
# ---------------------

RUN npm run build

RUN npm install -g serve
EXPOSE 3000
CMD ["serve", "-s", "dist"]