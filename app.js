var _ = require('lodash');
var request = require('request');
var rp = require('request-promise');
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

try {
  var docker = new Docker();

  var container = docker.getContainer('vna-server');
  
//TODO: Look for label vna-version and compare with docker hubs created time, not parsed probably

  // query API for container info 
  container.inspect(function (err, data) {
    console.log(data);
  });

  getMostRecentTag("kylejw", "etcd-arm")
    .then(latest => console.log((latest)));


} catch(ex) {
  log.error("Fatal :: " + JSON.stringify(ex));
} finally {
  // Sleep so docker restart doesnt cause an update right away
  Promise
    .delay(EXIT_DEBOUNCE_MS)
    .then(() => log.info("Exiting application"));
}



