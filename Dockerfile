FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json
RUN npm install

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json
RUN npm install --omit=dev

COPY --from=builder /app/server ./server
COPY --from=builder /app/web/dist ./web/dist

EXPOSE 4173
CMD ["npm", "run", "start"]
