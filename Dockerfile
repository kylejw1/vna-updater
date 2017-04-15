FROM hypriot/rpi-node:7-onbuild

WORKDIR /app

COPY . .

RUN npm install

CMD node app.js