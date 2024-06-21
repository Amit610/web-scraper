FROM ghcr.io/puppeteer/puppeteer:22.11.0
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app 

COPY package*.json ./
RUN npm i
COPY . .
CMD [ "npm", "start" ]