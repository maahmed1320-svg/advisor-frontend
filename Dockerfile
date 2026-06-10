# 1. Use an official Node image
FROM node:20-alpine

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy package.json and package-lock.json first
COPY package*.json ./

# 4. Install all dependencies
RUN npm ci

# 5. Copy the rest of your project files
COPY . .

# 6. Run the build command
RUN npm run build

# 7. Install 'serve' to host the build output
RUN npm install -g serve

# 8. Expose the port (Vite/serve usually uses 3000)
EXPOSE 3000

# 9. Start the static server
CMD ["serve", "-s", "dist"]