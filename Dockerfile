FROM node:20-alpine

WORKDIR /app

COPY backend/package.json ./package.json
COPY backend/package-lock.json ./package-lock.json

RUN npm ci --omit=dev

COPY backend/src ./src

EXPOSE 4000

CMD ["npm", "start"]
