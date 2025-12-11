FROM node:20
WORKDIR /app

COPY package.json ./
RUN npm install

COPY subscriber_email.js subscriber_log.js ./

CMD ["node", "subscriber_log.js"]

COPY package*.json ./
RUN npm install

COPY subscriber_email.js ./
COPY subscriber_log.js ./

CMD ["node", "subscriber_email.js"]