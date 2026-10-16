# Installing

drachtio server can be run from the official Docker image, or built from source.  Source code is available on [github](https://github.com/drachtio/drachtio-server).

::: info Note
drachtio server 0.9.x must be used with drachtio-srf 5.0.0 or later, due to changes in the wire protocol.
:::

## Docker

A [docker image](https://hub.docker.com/r/drachtio/drachtio-server/) is published for both `linux/amd64` and `linux/arm64`:
```bash
docker pull drachtio/drachtio-server:latest
```

The `latest` tag tracks the tip of the `main` branch.  Each release is also published under its version number without the leading "v" (e.g. `drachtio/drachtio-server:0.9.11`), which is preferable for production deployments.

The image is built on `debian:bookworm-slim`, with drachtio compiled with tcmalloc.  The image contains a default configuration file at `/etc/drachtio.conf.xml` (copied from [docker.drachtio.conf.xml](https://github.com/drachtio/drachtio-server/blob/main/docker.drachtio.conf.xml)) which:

* listens for application connections on port 9022 on all interfaces, using the shared secret `cymru`
* listens for SIP on port 5060 (udp and tcp) on all interfaces, since no contacts are configured
* logs to the console at `debug` level, with a sofia log level of 9
* enables CDRs and a basic spammer filter

You will usually want to override some of these settings with [command-line arguments or environment variables](configuring.md) when running the container. At a minimum, change the shared secret:
```bash
docker run -d --name drachtio --net=host \
  -e DRACHTIO_SECRET=my-secret \
  -e DRACHTIO_LOGLEVEL=info \
  -e DRACHTIO_SOFIA_LOGLEVEL=3 \
  drachtio/drachtio-server:latest
```

Host networking (`--net=host`) is generally the simplest way to run a SIP server in Docker.  Running and configuring the container is described in more detail [here](running.md#running-in-docker).

## Building from source

The build is most heavily tested on Debian and Ubuntu (the official Docker image is built on Debian 12 "bookworm").  It has also had at least some testing on Debian 8-12, CentOS, Fedora, Linux Mint and macOS, and it can be built on arm64.

### Prerequisites

The following packages are required to build on Debian or Ubuntu:
```bash
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  ca-certificates gcc g++ make build-essential cmake git \
  autoconf automake libtool libtool-bin \
  libssl-dev libcurl4-openssl-dev zlib1g-dev \
  libboost-all-dev libgoogle-perftools-dev
```

Notes:

* `libgoogle-perftools-dev` is only needed if you build with tcmalloc (see below), which is recommended and is how the Docker image is built.
* Instead of `libboost-all-dev`, it is sufficient to install the specific boost libraries that are used: `libboost-filesystem-dev libboost-log-dev libboost-system-dev libboost-thread-dev`.
* `cmake` is needed because some of the bundled dependencies are built with it.

All other third-party dependencies are included as git submodules under `deps/`: the [sofia SIP stack](https://github.com/davehorton/sofia-sip), [jansson](https://github.com/akheron/jansson), [hiredis](https://github.com/redis/hiredis) and [prometheus-cpp](https://github.com/jupp0r/prometheus-cpp).  These are built and statically linked automatically as part of `make`.

### Building

```bash
git clone --depth=50 --branch=main https://github.com/drachtio/drachtio-server.git
cd drachtio-server
git submodule update --init --recursive
./autogen.sh
mkdir build && cd $_
../configure --enable-tcmalloc=yes CPPFLAGS='-DNDEBUG'
make -j$(nproc)
sudo make install
```

To build a specific release rather than the tip of `main`, check out its tag (e.g. `git checkout v0.9.11`) before updating the submodules.

The supported `configure` options are:

* `--enable-tcmalloc=yes` link with [tcmalloc](https://google.github.io/tcmalloc/overview.html), a faster memory allocator (requires `libgoogle-perftools-dev`).  Default: no.
* `--enable-asan=yes` build with AddressSanitizer and UndefinedBehaviorSanitizer.  This is for debugging only, and cannot be combined with `--enable-tcmalloc`.

The `CPPFLAGS='-DNDEBUG'` setting disables assertions and should be used for production builds.

### Output

The output of the build is a single executable named `drachtio`.  `sudo make install` copies it to `/usr/local/bin/drachtio`; alternatively, you can run it directly from the build directory.

Sample configuration files are found in the root of the repository: [drachtio.conf.xml](https://github.com/drachtio/drachtio-server/blob/main/drachtio.conf.xml) is a heavily commented example.  Copy it to `/etc/drachtio.conf.xml` (the default location the server reads its configuration from) and edit as needed.  See [Configuring](configuring.md) for details.

To run drachtio as a service, see [Running](running.md).

## Other installation methods

For those who use [Ansible](https://www.ansible.com/) for automating builds, an [ansible role](https://github.com/davehorton/ansible-role-drachtio) is also available (it is maintained separately from drachtio-server).

Please post any issues [here](https://github.com/drachtio/drachtio-server/issues) if you have problems building.
