var _ = require('lodash');
var dockerHubAPI = require('docker-hub-api');
var Promise = require('bluebird');
var log = require('winston');
var exec = require('child_process').exec;

const EXIT_DEBOUNCE_MS = 60*1000;
const VNA_SERVER_CONTAINER_NAME = "vna-server";

function getMostRecentTagName(user, repo) {
  return dockerHubAPI.tags(user, repo)
    .then(tags => {
      var tag = _(tags)
        .reject({name: 'latest'}) 
        .max(tag => getTagLastUpdated(tag));

      return `${user}/${repo}:${tag.name}`;
    });
}

function getTagLastUpdated(tag) {
  return new Date(tag.last_updated);
}

function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error || stderr) {
        return reject(`exec error: error=${error} stderr=${stderr}`);
      }
      return resolve(stdout);
    });
  });
}

function getContainerImage(name) {
  log.info("Getting image: " + name);

  return execPromise(`docker inspect --format='{{.Config.Image}}' ${name}`)
  .catch(err => {
    log.warn(`Failed to get container image for ${name} :: ${err}`);
    return Promise.resolve(null);
  });
}

function getCurrentVnaServerImage() {
  return getContainerImage(VNA_SERVER_CONTAINER_NAME);
}

function updateVnaServerContainer(oldImage, newImage) {
  return execPromise(`/bin/bash -c "docker pull ${newImage} && docker rm -f vna-server || true && docker rmi ${oldImage} || true && docker run --name vna-server -d -p 80:1337 --restart always ${newImage} node app.js --prod"`);
}

var promises = [];

promises.push(getMostRecentTagName("kylejw", "vna-server")
  .then(latest => {
    log.info(`Latest tag: ${latest}`);
    return latest;
  }));

promises.push(getCurrentVnaServerImage());

Promise.all(promises)
  .then(results => {
    var latestImage = (results[0] || "").trim();
    var currentImage = (results[1] || "").trim();

    if (latestImage && latestImage !== currentImage) {
      log.info(`Image mismatch.  Will update. latest=${latestImage} current=${currentImage}`);
      return updateVnaServerContainer(currentImage, latestImage);
    } else {
      log.info(`Image matches.  No update necessary latest=${latestImage} current=${currentImage}`);
    }
  })
  .catch(err => log.error("Fatal :: " + err))
  .then(() => log.info(`Iteration complete.  Sleeping for ${EXIT_DEBOUNCE_MS} msec`))
  .delay(EXIT_DEBOUNCE_MS);
