var _ = require('lodash');
var dockerHubAPI = require('docker-hub-api');
var Promise = require('bluebird');
var log = require('winston');
var Docker = require('dockerode');

// TODO: Make sure to pull and restart on start, then poll every x minutes after
// TODO: Try catch finally make sure to sleep so no pinning

const EXIT_DEBOUNCE_MS = 60*1000;


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

function containerInspect(container) {
  return new Promise((resolve, reject) => {
    container.inspect((err, data) => {

      if (err) {
        log.error("Container inspect error :: " + err);
        return reject(err);
      }
      return resolve(data);
    });
  });
}

function getContainerImage(container) {
  return containerInspect(container)
    .then(data => {
      var image = data.Config.Image;
      if (!image) {
        log.error(`Could not parse current container image tag`);
        throw err;
      }
    }).catch(err => {
      return null;
    });
}

function getCurrentVnaServerImage(docker) {
  try {
    var container = docker.getContainer('vna-server');
  } catch(err) {
    log.warn("Could not find existing vna-server container.");
    return Promise.resolve(null);
  }
  return getContainerImage(container);
}

function pullImage(docker, image) {
  return new Promise((resolve, reject) => {
    docker.pull(image, (err, stream) => {
      if (err) return reject(err);
      docker.modem.followProgress(stream, onFinished, onProgress);
      function onFinished(err, output) {
        if(err) return reject(err);
        log.info("Pull complete :: " + JSON.stringify(output));
        return resolve(output);
      }
      function onProgress(event) {
        log.info("Pull progress :: " + JSON.stringify(event));
      }
    });
  });
}

function removeContainer(docker, containerName) {

  return new Promise((resolve, reject) => {
    try {
      var container = docker.getContainer(containerName);
    } catch(err) {
      return reject(err);
    }

    container.remove({force: true}, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

function update(docker, image, containerName) {
  return pullImage(docker, image)
    .then(() => removeContainer(docker, containerName));
}

try {
  //getContainerImage(container).then(image => log.info("Image: " + image));


  // TODO: if null
  
//TODO: Look for label vna-version and compare with docker hubs created time, not parsed probably

  // query API for container info 

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
        return update(docker, latestImage, "vna-server");
      } else {
        log.info(`Image matches.  No update necessary latest=${latestImage} current=${currentImage}`);
      }
    })
    .catch(err => log.error("Fatal :: " + err));


} catch(ex) {
  log.error("Fatal :: " + err);
} finally {
  // Sleep so docker restart doesnt cause an update right away
  Promise
    .delay(EXIT_DEBOUNCE_MS)
    .then(() => log.info("Exiting application"));
}



