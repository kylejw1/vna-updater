var _ = require('lodash');
var dockerHubAPI = require('docker-hub-api');
var Promise = require('bluebird');
var log = require('winston');
var Docker = require('dockerode');

// TODO: Make sure to pull and restart on start, then poll every x minutes after
// TODO: Try catch finally make sure to sleep so no pinning

const EXIT_DEBOUNCE_MS = 60*1000;


function getMostRecentTag(user, repo) {
  return dockerHubAPI.tags(user, repo)
    .then(tags => _(tags).reject({name: 'latest'}).max(tag => getTagLastUpdated(tag)));
}

function getTagLastUpdated(tag) {
  return new Date(tag.last_updated);
}

function containerInspect(container) {
  return new Promise((resolve, reject) => {
    container.inspect((err, data) => {

      if (err) {
        return reject(err);
      }
      return resolve(data);
    });
  });
}

function getContainerImage(container) {
  return containerInspect(container, {format:'{{.Config.Image}}'})
    .then(data => data.Config.Image);
}

try {
  var docker = new Docker();

  var container = docker.getContainer('vna-server');

  getContainerImage(container).then(image => log.info("Image: " + image));
  // TODO: if null
  
//TODO: Look for label vna-version and compare with docker hubs created time, not parsed probably

  // query API for container info 


  getMostRecentTag("kylejw", "etcd-arm")
    .then(latest => log.info((latest)));


} catch(ex) {
  log.error("Fatal :: " + JSON.stringify(ex));
} finally {
  // Sleep so docker restart doesnt cause an update right away
  Promise
    .delay(EXIT_DEBOUNCE_MS)
    .then(() => log.info("Exiting application"));
}



