# Running

The drachtio-server executable built from source code is simply named `drachtio`.  By default, the build process installs it in `/usr/local/bin/drachtio`.

## Running from the command line

If run with no command-line arguments, drachtio reads its configuration from `/etc/drachtio.conf.xml` and runs in the foreground.  A different configuration file can be specified with the `-f` option (or the `DRACHTIO_CONFIG_FILE_PATH` environment variable):
```bash
drachtio -f ../drachtio.conf.xml
```

Many settings can also be supplied as command-line arguments or environment variables, which take precedence over the configuration file:
```bash
drachtio --contact "sip:*;transport=udp,tcp" --port 9022 --secret cymru --loglevel info --stdout
```

To see the list of command-line options, run `drachtio -h`; to print the version, run `drachtio --version`.  All of the options are described in [Configuring](configuring.md#command-line-arguments).

To run drachtio as a background daemon process, pass the `--daemon` argument.  The process forks, prints the process id of the daemon, and the parent exits.  When daemonized, `--user <name>` can be used to have the daemon process run as the named user.

### Signals

* `SIGHUP` causes drachtio to re-read its configuration file.  The `loglevel` and `sofia-loglevel` settings from the file are applied immediately; settings such as the SIP contacts and the admin port require a restart.
* `SIGTERM` causes drachtio to log some statistics and then exit.

## Running as a systemd service

On systemd distributions, drachtio can be installed as a systemd service using the unit file found in the repository at [drachtio.service](https://github.com/drachtio/drachtio-server/blob/main/drachtio.service).  That unit runs `/usr/local/bin/drachtio --daemon` (with `Type=forking`) as root, using the default configuration file `/etc/drachtio.conf.xml`, and raises a number of process limits and scheduling priorities.

To install it after building from source:
```bash
sudo cp drachtio.service /etc/systemd/system/drachtio.service
sudo systemctl daemon-reload
sudo systemctl enable drachtio
```

The following commands are then supported:
```bash
sudo systemctl [start|stop|restart|status] drachtio
```

::: info Note
Edit the `ExecStart` line in the unit file if you want to pass additional command-line arguments (for instance `-f` to use a configuration file in a different location).  Environment variables can be supplied with `Environment=` lines in the `[Service]` section.
:::

For SysV-style init systems, an init script is also provided in the repository: [drachtio-init-script](https://github.com/drachtio/drachtio-server/blob/main/drachtio-init-script).

[Ansible](https://www.ansible.com/) users can alternatively use the [ansible role](https://github.com/davehorton/ansible-role-drachtio), which installs drachtio as a systemd service automatically.

## Running in Docker

The [drachtio/drachtio-server](https://hub.docker.com/r/drachtio/drachtio-server/) image runs `drachtio` through an [entrypoint script](https://github.com/drachtio/drachtio-server/blob/main/entrypoint.sh).  When the container command is `drachtio` (the default), any further arguments are passed to the drachtio executable, so the server can be configured entirely from the `docker run` command line:
```bash
docker run -d --name drachtio --net=host \
  drachtio/drachtio-server:latest \
  drachtio --contact "sip:10.0.0.5;transport=udp,tcp" --secret my-secret --loglevel info
```
or via [environment variables](configuring.md#environment-variables):
```bash
docker run -d --name drachtio --net=host \
  -e DRACHTIO_SECRET=my-secret \
  -e DRACHTIO_ADMIN_TCP_PORT=9022 \
  drachtio/drachtio-server:latest
```

The image includes a [default configuration file](installing.md#docker) at `/etc/drachtio.conf.xml`.  To use your own configuration file instead, mount it into the container and point to it with `-f`:
```bash
docker run -d --name drachtio --net=host \
  -v $(pwd)/drachtio.conf.xml:/config/drachtio.conf.xml \
  drachtio/drachtio-server:latest \
  drachtio -f /config/drachtio.conf.xml
```

::: info Note
If you are not using host networking, remember to publish the SIP ports (e.g. `-p 5060:5060/udp -p 5060:5060/tcp`) and the admin port (`-p 9022:9022`), and to configure the externally visible address of the server with `--external-ip` so that it is used in the SIP signaling.
:::

### Cloud deployments

The entrypoint script can discover the local and public IP addresses of the host from the metadata service of several cloud providers.  To use this, set the `CLOUD` environment variable to one of `aws`, `gcp`, `azure`, `digitalocean`, `scaleway` or `exoscale` and pass `--cloud-deployment` as an argument:
```bash
docker run -d --name drachtio --net=host \
  -e CLOUD=aws \
  drachtio/drachtio-server:latest \
  drachtio --cloud-deployment --secret my-secret
```

`--cloud-deployment` is replaced by a `--contact sip:<local-ip>:<port>;transport=udp,tcp` argument, plus `--external-ip <public-ip>` if the host has a public address (on DigitalOcean, a second contact on the public address is added instead).  The following environment variables are also used by the entrypoint script:

| Variable | Description |
|----------|-------------|
| `CLOUD` | cloud provider to query for the host's IP addresses: `aws`, `gcp`, `azure`, `digitalocean`, `scaleway` or `exoscale` |
| `DRACHTIO_SIP_PORT` | SIP port used in the contact generated by `--cloud-deployment` (default: 5060) |
| `TLS_PORT` | if set (and a public IP was discovered), also listen for SIP over TLS on this port |
| `WSS_PORT` | if set (and a public IP was discovered), also listen for SIP over secure websockets on this port |
| `IMDSv2` | on AWS, set to any value to use IMDSv2 (token-based) metadata requests |
| `LB_IMDS` | on Azure, set to `true` to get the addresses from the load balancer metadata endpoint |

When using `TLS_PORT` or `WSS_PORT`, the TLS certificate files must also be supplied (e.g. with the `DRACHTIO_TLS_*` environment variables described in [Configuring](configuring.md#tls)).
