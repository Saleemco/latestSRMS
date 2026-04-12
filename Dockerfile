FROM node:18

WORKDIR /app

# Copy everything
COPY . .

# ===== BACKEND =====
WORKDIR /app/backend
RUN npm install

# ===== FRONTEND =====
WORKDIR /app/frontend
RUN npm install
RUN npm run build

# Move frontend build into backend
RUN cp -r dist /app/backend/public

# ===== RUN BACKEND =====
WORKDIR /app/backend

EXPOSE 3000

CMD ["npm", "start"]