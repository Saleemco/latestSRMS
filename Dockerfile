FROM node:18

WORKDIR /app

COPY . .

# ===== BACKEND =====
WORKDIR /app/backend
RUN npm install

# ===== FRONTEND =====
WORKDIR /app/frontend
RUN npm install
RUN npm run build

# Ensure public folder exists
RUN mkdir -p /app/backend/public
RUN cp -r dist/* /app/backend/public

# ===== RUN BACKEND =====
WORKDIR /app/backend

EXPOSE 3000

CMD ["npm", "start"]