FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

# Listen on all interfaces so the published port is reachable from the host
ENV HOST=0.0.0.0
EXPOSE 3001

USER node
CMD ["node", "src/index.js"]
