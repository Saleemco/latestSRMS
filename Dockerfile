FROM node:18

WORKDIR /app

# Copy everything
COPY . .

# Install backend deps
WORKDIR /app/backend
RUN npm install

# Install frontend deps and build
WORKDIR /app/frontend
RUN npm install
RUN npm run build

# Move frontend build into backend
RUN cp -r dist /app/backend/public

# Back to backend
WORKDIR /app/backend

EXPOSE 3000

CMD ["npm", "start"]