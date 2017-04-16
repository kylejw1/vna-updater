FROM hypriot/rpi-node:7

WORKDIR /app

COPY package.json .

RUN npm install

COPY . .

CMD node app.js