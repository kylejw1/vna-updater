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
    }).catch(err => {
      log.error(`Could not locate most recent tag on docker hub: ${user}/${repo}`);
      throw err;
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

function pullImage(image) {
  log.info("Pulling image " + image);
  return execPromise(`docker pull ${image}`)
    .then(log.info(`Image ${image} pulled successfully`))
    .catch(err => {
      throw `Failed to pull image ${image} :: ${err}`;
    });
}

function forceRemoveContainer(name) {
  log.info("Removing container " + name);
  return execPromise(`docker rm -f ${name}`)
    .catch(err => {
      throw `Failed to remove container ${name} :: ${err}`;
    });
}

function runContainer(name, image, options) {
  var runCmd = `docker run --name ${name} ${options} ${image}`;
  log.info(`Run container '${runCmd}'`);
  return execPromise(runCmd)
    .catch(err => {
      throw `Failed to run container ${name} :: ${err}`;
    });
}

function runVnaServerContainer(image) {
  return runContainer(VNA_SERVER_CONTAINER_NAME, image, "-d -p 1337:1337 --restart always");
}

function updateVnaServerContainer(image) {
  return pullImage(image)
    .then(forceRemoveContainer(VNA_SERVER_CONTAINER_NAME))
    .then(runVnaServerContainer(image));
}

var docker = new Docker();
var latestImage;
var promises = [];

promises.push(getMostRecentTagName("kylejw", "etcd-arm")
  .then(latest => {
    log.info(`Latest tag: ${latest}`);
    return latest;
  }));

promises.push(getCurrentVnaServerImage());

Promise.all(promises)
  .then(results => {
    var latestImage = results[0];
    var currentImage = results[1];

    if (latestImage && latestImage !== currentImage) {
      log.info(`Image mismatch.  Will update. latest=${latestImage} current=${currentImage}`);
      return updateVnaServerContainer(latestImage);
    } else {
      log.info(`Image matches.  No update necessary latest=${latestImage} current=${currentImage}`);
    }
  })
  .catch(err => log.error("Fatal :: " + err))
  .then(() => log.info(`Iteration complete.  Sleeping for ${EXIT_DEBOUNCE_MS} msec`))
  .delay(EXIT_DEBOUNCE_MS);
