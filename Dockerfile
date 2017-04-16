FROM hypriot/rpi-node:7-onbuild

WORKDIR /app

COPY package.json .

RUN npm install

COPY . .

CMD node app.js