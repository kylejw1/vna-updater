# vna-updater

# Build/push
```
docker build -t kylejw/vna-updater:1.0.0 .
docker push kylejw/vna-updater:1.0.0
```

# Run

```
docker run -d \
  --name vna-updater \
  --restart always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /usr/bin/docker:/usr/bin/docker \
  kylejw/vna-updater:1.0.0

```
