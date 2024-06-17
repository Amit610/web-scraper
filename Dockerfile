FROM ghcr.io/puppeteer/puppeteer:22.11.0
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .
CMD [ "start", "node server.js" ]