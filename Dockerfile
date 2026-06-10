FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Use a separate stage for the production server
FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist /app/dist

EXPOSE 3000
# Serve the static files directly
CMD ["serve", "-s", "dist", "-l", "3000"]