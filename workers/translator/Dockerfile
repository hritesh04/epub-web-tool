FROM node:24.14.1-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev 

FROM node:24.14.1-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24.14.1-alpine
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
CMD ["node", "./dist/index.js"]