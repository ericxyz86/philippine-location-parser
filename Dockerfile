FROM node:22-alpine

WORKDIR /app

COPY app/package*.json ./
RUN npm ci --omit=dev

COPY app/ ./

ENV NODE_ENV=production
ENV PORT=3002

EXPOSE 3002

CMD ["node", "server-v5.js"]
