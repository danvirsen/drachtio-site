# Configuring

The drachtio process can either be configured via command-line parameters, environment variables, a configuration file -- or a combination of all three.  The order of precedence of configuration settings is as follows:

* command-line parameters, if provided, always take precedence
* otherwise environment variables, if provided, take precedence
* otherwise configuration file settings are used.

This is evaluated on a parameter-by-parameter basis; i.e. one setting may be provided by an environment variable, some others by command-line arguments, and the rest by the configuration file.  Note that some settings can only be provided in one or two of these ways; this is noted for each setting below.

By default, the server will look for a configuration file at `/etc/drachtio.conf.xml`.  This can be changed by passing the configuration file path as a command line argument `-f`; e.g., `drachtio -f /tmp/drachtio.conf.xml`, or by setting the `DRACHTIO_CONFIG_FILE_PATH` environment variable.

::: info Note
A configuration file is always required, and it must contain at least an `<admin>` element; the server exits at startup if the file cannot be read or has no `<admin>` element.  When everything else is supplied via command-line arguments or environment variables, a minimal file such as `<drachtio><admin port="9022" secret="cymru">0.0.0.0</admin></drachtio>` is sufficient.
:::

As the name suggests, the configuration file is in XML format.  The structure of the file is described below, and [a heavily commented version of the file can be found here](https://github.com/drachtio/drachtio-server/blob/main/drachtio.conf.xml) that provides additional detail to the summary provided below.

::: info Note
Only XML configuration files are supported.  The `drachtio.conf.json` file found in the drachtio-server repository is not read by the server.
:::

## drachtio.conf.xml

A drachtio configuration file has the following high-level structure:
```xml
<drachtio>
  <admin/>
  <request-handlers/>
  <sip/>
  <cdrs/>
  <monitoring/>
  <logging/>
</drachtio>
```
Each section is described below, along with the command line parameters and environment variables that can be used to configure the same settings.

### admin section
The **admin** section is required and specifies how the drachtio server will listen for incoming connections from drachtio applications. The information includes the tcp port to listen on, the address to listen on (0.0.0.0 means all available interfaces), the shared secret that is used for authentication, and the interval at which tcp keepalives will be sent on these connections.

There is also an option to use tls encryption on connections.  For inbound connections, this is specified by providing a 'tls-port' option.  The server can be configured to handle either, or both, tcp and tls connections.
```xml
<admin port="9022" tls-port="9023" secret="cymru" tcp-keepalive="30">0.0.0.0</admin>
```
or, using command-line parameters:
```bash
drachtio --address 0.0.0.0 --port 9022 --tls-port 9023 --secret cymru --tcp-keepalive-interval 30
```
or, using environment variables:
```bash
DRACHTIO_ADMIN_ADDRESS=0.0.0.0 \
DRACHTIO_ADMIN_TCP_PORT=9022 \
DRACHTIO_ADMIN_TLS_PORT=9023 \
DRACHTIO_TCP_KEEPALIVE_INTERVAL=30 \
DRACHTIO_SECRET=cymru drachtio
```

The attributes of the `<admin>` element are:

* `port`: tcp port to listen on for application connections (default: 9022)
* `tls-port`: tls port to listen on for application connections (default: none)
* `secret`: the shared secret that applications must provide to authenticate (default: `admin`)
* `tcp-keepalive`: interval, in seconds, for tcp keepalives on application connections (default: 45).  Set to zero to disable tcp keepalives.

The text of the element is the address to listen on.

When a `tls-port` is configured, the [tls](#tls) settings must provide a key file, a certificate (or chain) file, and a dhparam file, or the server will fail to start.  See [Using TLS to encrypt messages between application and server](../srf/advanced-topics.md#using-tls-to-encrypt-messages-between-application-and-server) for more details.

### request-handlers section
The **request-handlers** section is optional and configures the drachtio process to establish [outbound connections](../srf/advanced-topics.md#outbound-connections) to drachtio applications for some or all SIP methods instead of **inbound connections**.  SIP methods that do not have a request handler (and are not covered by a `sip-method="*"` handler) continue to be delivered to applications over inbound connections.

There are two ways to route requests to your drachtio application:

1. **HTTP callback**: Drachtio makes an HTTP request to your web service, which returns routing instructions
2. **Direct outbound**: Drachtio connects directly to your application via TCP/TLS (no HTTP callback needed)

#### Using HTTP callbacks

Configure your application URL in the request-handlers section:

```xml
<request-handlers>
    <request-handler sip-method="INVITE" http-method="GET" verify-peer="false">https://38.187.89.96:8080</request-handler>
</request-handlers>
```
The attributes of the `<request-handler>` element are:

* `sip-method`: the SIP method to route using this handler, or `*` for all methods (default: `*`)
* `http-method`: `GET` or `POST` (default: `GET`)
* `verify-peer`: for https URLs, whether to verify the server certificate (`true` or `false`, default: `false`)

or, using command-line parameters (this applies to all SIP methods):
```bash
drachtio --http-handler "http://38.187.89.96:8080" --http-method GET
```
or, using environment variables (this applies to all SIP methods, and always uses HTTP GET):
```bash
DRACHTIO_HTTP_HANDLER_URI=http://38.187.89.96:8080 drachtio
```

With HTTP callbacks, when a new SIP request arrives, drachtio sends an HTTP request to your callback URL (with a `/` appended to the path) with the following query parameters:

* `method`: the SIP method of the request
* `domain`: the SIP domain in the Request-URI
* `protocol`: the transport protocol used (e.g. 'udp', 'tcp', 'wss', etc)
* `source_address`: the IP address of the sender
* `fromUser`: the user part of the uri in the From header
* `toUser`: the user part of the uri in the To header
* `uriUser`: the user part of the uri in the Request-URI
* `contentType`: the Content-Type header in the request, if any
* `uri`: the full Request-URI

Additionally, any parameters in the Request-URI are added as query parameters as well.

> Note: either HTTP or HTTPS URIs are supported. Server certificates are only verified when `verify-peer="true"` is set.

> Note: setting `http-method="POST"` will cause an HTTP POST to be sent with the full SIP message as the body (with `Content-Type: text/plain`), in addition to the query parameters.

Your HTTP callback returns a JSON response with an `action` and a `data` object, which directs how to handle the request:

```js
// reject the request
{ "action": "reject", "data": { "status": 503, "reason": "Max Calls Exceeded" } }

// redirect the request with a 302 response; contact may be a string or an array
{ "action": "redirect", "data": { "contact": ["sip:new-destination@example.com"] } }

// proxy to another server; destination may be a string or an array
{ "action": "proxy", "data": { "destination": ["sip:proxy.example.com"], "recordRoute": true } }

// route to a drachtio application (outbound connection)
{ "action": "route", "data": { "uri": "myapp.example.com:3000" } }

// route to a drachtio application with a specific tag
{ "action": "route", "data": { "tag": "conferencing-app" } }
```

For the `proxy` action, the following optional properties may also be included in `data`: `followRedirects` (default: true), `simultaneous` (default: false), `provisionalTimeout` (default: "5s") and `finalTimeout` (default: "60s").  `recordRoute` defaults to false.

If the HTTP response cannot be parsed, or contains an invalid action, the SIP request is rejected with a 500 response.

#### Using direct outbound connections

Instead of an HTTP callback, you can route directly to a drachtio application using `tcp://` or `tls://` URIs:

```xml
<request-handlers>
    <request-handler sip-method="INVITE">tcp://app1.example.com:3000</request-handler>
    <request-handler sip-method="REGISTER">tcp://app2.example.com:3001</request-handler>
    <request-handler sip-method="MESSAGE">tls://app3.example.com:3002</request-handler>
</request-handlers>
```
or, using command-line parameters:
```bash
drachtio --http-handler "tcp://38.187.89.96:8080"
```
or, using environment variables:
```bash
DRACHTIO_HTTP_HANDLER_URI=tcp://38.187.89.96:8080 drachtio
```

This is useful when:

- You want to use outbound connections but don't need dynamic routing
- You want to place a load balancer between drachtio-server and your applications
- You want different SIP methods handled by different applications

### sip section

The `<sip>` section defines which addresses and ports the SIP stack will listen on, which protocols will be supported, where to find (if necessary) SSL certificates, and other SIP options.

#### contacts
The drachtio server can listen on multiple interfaces/addresses for SIP traffic. These are defined in a `<contacts>` element that has child `<contact>` elements for each SIP endpoint.  Examples of possible configuration are shown below.

```xml
<!-- listen on all addresses, default port 5060 for udp and tcp protocols -->
<sip>
  <contacts>
    <contact>sip:*;transport=udp,tcp</contact>
  </contacts>
</sip>
```
```xml
<!-- listen on ports 5060 and 5080 -->
<contacts>
  <contact>sip:*;transport=udp,tcp</contact>
  <contact>sip:*:5080;transport=udp,tcp</contact>
</contacts>
```
```xml
<!-- listen for websockets, tls and secure websockets -->
<contacts>
  <contact>sip:*:80;transport=ws</contact>
  <contact>sips:*;transport=tls</contact>
  <contact>sips:192.168.100.23:443;transport=wss</contact>
</contacts>
```
> Note: use a `sips:` URI for `tls` and `wss` contacts; the server only applies the [tls](#tls) certificate settings to contacts that use a `sips:` URI or `transport=tls`.

If no contacts are configured (either here or on the command line), the server listens on `sip:*;transport=udp,tcp`, i.e. port 5060 on all interfaces for udp and tcp.

Additionally, if the SIP server has been assigned an external address that should be used in the SIP signaling, this should be specified as follows:
```xml
<contacts>
  <contact external-ip="35.195.28.194">sip:10.132.0.22;transport=udp,tcp</contact>
</contacts>
```
This will cause the drachtio server to advertise its address as `35.195.28.194` in Contact and Via headers, even though its local assigned IP address is `10.132.0.22`.

Furthermore, if the drachtio server has an assigned DNS name, this should be configured as well so that it can detect when the Request-URI of an incoming SIP request is referring to the local host when the DNS name appears in the host portion.
```xml
<contacts>
  <contact dns-names="server01.drachtio.org" external-ip="35.195.28.194">sip:10.132.0.22;transport=udp,tcp</contact>
</contacts>
```
> Note: multiple DNS names can be provided, separated by commas, semicolons or spaces.

Finally, the local network associated with a contact can be specified in CIDR format with the `local-net` attribute.  This is useful when a server is connected to both public and private networks, to determine which contact to use when sending a request to a given address.
```xml
<contacts>
  <contact local-net="10.132.0.0/20">sip:10.132.0.22;transport=udp,tcp</contact>
  <contact>sip:35.195.28.194;transport=udp,tcp</contact>
</contacts>
```

SIP contacts can be supplied via command line as follows; the `--external-ip` and `--local-net` arguments apply to the `--contact` argument that they follow:
```
drachtio --contact "sip:10.132.0.22;transport=udp" --external-ip 35.195.28.194 \
  --contact "sip:192.168.1.10;transport=udp,tcp" --local-net 192.168.1.0/24
```
> Note: there is no option to specify SIP contacts via environment variables.  If any contacts are provided on the command line, the contacts in the configuration file are ignored.

#### local-domain

The drachtio server can be configured to reject outbound SIP requests that are sent to a specific domain. This is useful in containerized environments where you want to prevent SIP messages from being sent to the local domain.  This setting can only be provided as an environment variable:

```
DRACHTIO_LOCAL_DOMAIN=example.com drachtio
```
> Note: This will treat the specified domain and all its subdomains (e.g., `example.com`, `sub.example.com`, etc.) as referring to the drachtio server itself, so an application request to send to one of them fails with "can not send request to myself".

#### timers
The [SIP spec contains definitions for timers](https://tools.ietf.org/html/rfc3261#page-265) governing retransmissions of SIP requests and the like.  Generally, there is no need to modify the setting for these timers, but if desired this can be done as follows:
```xml
<timers>
  <t1>500</t1>
  <t2>4000</t2>
  <t4>5000</t4>
  <t1x64>32000</t1x64>
</timers>
```
> Note: values are in milliseconds.  The example above actually sets the timers to their defined default values, so if you are using this section you would likely be setting them to some other values.  You only need to specify those timers that you want to adjust from their default values.

#### session-timers

When an incoming INVITE requests a session timer ([RFC 4028](https://tools.ietf.org/html/rfc4028)) with a `Session-Expires` header that has no `refresher` parameter, the choice of refresher is left to the drachtio server.  The `default-refresher` attribute controls this:

```xml
<session-timers default-refresher="none"/>
```

* `none` (default): decline the session timer. The server does not include `Session-Expires` in its response, and the call is never torn down for lack of a refresh.
* `uac`: the caller must refresh the session; if it stops refreshing, the server sends a BYE.  This is useful as dead-peer detection on the calling side (e.g. WebRTC clients).
* `uas`: the drachtio server refreshes the session.

If the caller supplies a `refresher` parameter, it is always honored and this setting does not apply.  This setting can only be provided in the configuration file.

#### tls
If you are using either TLS or WSS as a transport, then you must specify where the associated tls certificates are stored on the server.

Additionally, when using tls on admin connections from applications, you must specify a dhparam file that contains the Diffie-Hellman (dh) parameters.  (This is not required if you are only using TLS to secure SIP connections).

Finally, you can optionally specify the minimum acceptable TLS version (1.0, 1.1, or 1.2).  If not specified, TLS 1.0 and above will be accepted.

```xml
<tls>
  <min-tls-version>1.2</min-tls-version>
  <key-file>/etc/letsencrypt/live/yourdomain/privkey.pem</key-file>
  <cert-file>/etc/letsencrypt/live/yourdomain/cert.pem</cert-file>
  <chain-file>/etc/letsencrypt/live/yourdomain/chain.pem</chain-file>
  <dh-param>/var/local/private/dh4096.pem</dh-param>
</tls>
```
or, via command-line
```
drachtio --key-file /etc/letsencrypt/live/yourdomain/privkey.pem \
--cert-file /etc/letsencrypt/live/yourdomain/cert.pem \
--chain-file /etc/letsencrypt/live/yourdomain/chain.pem \
--dh-param /var/local/private/dh4096.pem \
--min-tls-version 1.2 \
--tls-cipherlist "HIGH:!aNULL:!MD5"
```

or, via environment variables
```
DRACHTIO_TLS_CERT_FILE=/etc/letsencrypt/live/yourdomain/cert.pem \
DRACHTIO_TLS_CHAIN_FILE=/etc/letsencrypt/live/yourdomain/chain.pem \
DRACHTIO_TLS_KEY_FILE=/etc/letsencrypt/live/yourdomain/privkey.pem \
DRACHTIO_TLS_DH_PARAM_FILE=/var/local/private/dh4096.pem \
DRACHTIO_MIN_TLS_VERSION=1.2 \
DRACHTIO_TLS_CIPHER_LIST="HIGH:!aNULL:!MD5" \
drachtio
```

Both a key file and a certificate file are required for SIP over TLS or WSS.

The following TLS settings can only be provided via command-line or environment variables:

* the list of ciphers to allow for SIP over TLS, in OpenSSL cipher list format (`--tls-cipherlist` or `DRACHTIO_TLS_CIPHER_LIST`; default: all strong ciphers supported).
* `DRACHTIO_TLS_VERIFY_CLIENT_CERT=1` causes the server to request and verify certificates from remote peers on SIP TLS connections.

#### best-effort-tls

When `best-effort-tls` is enabled and the server responds to a request that arrived over a TLS (`sips:`) transport, but the Contact header of that request has a `sip:` URI, the server will likewise use a `sip:` URI rather than a `sips:` URI in the Contact header of its response.  This setting can only be provided as an environment variable:

```
DRACHTIO_SUPPORT_BEST_EFFORT_TLS=1 drachtio
```

#### outbound-proxy
This causes all outbound requests to be sent through an outbound proxy.  This setting can only be provided in the configuration file.
```xml
<outbound-proxy>sip:10.10.10.1</outbound-proxy>
```

#### reject-register-with-no-realm

When enabled, the drachtio server will immediately reject, with a 403 Forbidden, any incoming REGISTER request that has an IP address rather than a domain (realm) in the host part of the Request-URI. This can be useful for reducing spam or unwanted registrations.

```xml
<reject-register-with-no-realm>true</reject-register-with-no-realm>
```
or, via command line
```
drachtio --reject-register-with-no-realm
```
or, via environment variables
```
DRACHTIO_REJECT_REGISTER_WITH_NO_REALM=1 drachtio
```

#### aggressive-nat-detection
When enabled, the presence of a `nat=yes` parameter in a Record-Route or Contact header of an incoming request is taken as an indication that the remote server is behind a NAT.

```xml
<aggressive-nat-detection>true</aggressive-nat-detection>
```
or, via command line
```
drachtio --aggressive-nat-detection
```
or, via environment variables (note the spelling of the variable name)
```
DRACHTIO_AGRESSIVE_NAT_DETECTION=1 drachtio
```

NAT detection can be turned off entirely with the `--disable-nat-detection` command-line argument (there is no configuration file or environment variable equivalent).

#### spammers
The drachtio server can examine the User-Agent header, and the user part of the To and From headers, of incoming requests for distinctive signatures that indicate the request was sent from a spam source.  A request is considered to be from a spammer if one of these headers contains any of the configured values.
```xml
<spammers action="reject" tcp-action="discard">
  <header name="User-Agent">
    <value>sip-cli</value>
    <value>sipcli</value>
    <value>friendly-scanner</value>
  </header>
  <header name="To">
    <value>sipvicious</value>
  </header>
</spammers>
```
The `action` attribute (and the `tcp-action` attribute, which applies to requests received over tcp, ws or wss) chooses whether to `reject` the request or silently `discard` it.

::: info Note
The `action` and `tcp-action` attributes currently have no effect: requests from a spammer are always rejected with a `603 Decline`.  Only the `User-Agent`, `To` and `From` headers are examined, and each `<header>` element must have a `name` attribute.  This setting can only be provided in the configuration file.
:::

#### user-agent-options-auto-respond
If an incoming OPTIONS request has a User-Agent header that exactly matches this value, the drachtio server responds immediately with a 200 OK rather than passing the request to an application.  This is useful for responding to health checks from load balancers or SBCs.

```xml
<user-agent-options-auto-respond>my-health-checker</user-agent-options-auto-respond>
```
or, via environment variables
```
DRACHTIO_USER_AGENT_OPTIONS_AUTO_RESPOND=my-health-checker drachtio
```

::: info Note
The `--user-agent-options-auto-respond` command-line argument does not accept a value, so use the configuration file or environment variable instead.
:::

#### capture-server
The drachtio server can be configured to send to [Homer](http://www.sipcapture.org/) using the [HEP](https://github.com/sipcapture/HEP) protocol.

```xml
<capture-server port="9060" hep-version="3" id="101">127.0.0.1</capture-server>
```
The `id` attribute is required, and must be a non-zero integer that identifies this server to Homer.  The `port` attribute defaults to 9060 and the `hep-version` attribute (1, 2 or 3) defaults to 3.

or, via command line (the port is optional and defaults to 9060)
```
drachtio --homer "127.0.0.1:9060" --homer-id 101
```
or, via environment variables:
```
DRACHTIO_HOMER_ADDRESS=127.0.0.1 \
DRACHTIO_HOMER_PORT=9060 \
DRACHTIO_HOMER_ID=101 drachtio
```
> Note: when using command-line arguments or environment variables, HEP version 3 over udp is always used, and the homer id is required.  When using environment variables, `DRACHTIO_HOMER_PORT` should always be set, since it does not default to 9060.

#### preserve-header-names

By default, the drachtio server normalizes the names of SIP headers to capitalize each word (e.g. `Max-Forwards`), except for headers starting with `X-`, which are left unchanged. This setting allows you to preserve the original case of specific headers.  It can only be provided as an environment variable:

```
DRACHTIO_PRESERVE_HEADER_NAMES="P-Custom-Header,P-Another-Header" drachtio
```
> Note: header names are matched case-insensitively against the comma-separated list, and matching headers are sent out exactly as provided.

#### udp-buffer-size

Sets the size, in bytes, of the socket send and receive buffers for udp transports.  The default is 4 MB.  This setting can only be provided in the configuration file.

```xml
<udp-buffer-size>8388608</udp-buffer-size>
```

#### udp-mtu

Sets the message size, in bytes, above which outbound requests are sent over TCP instead of UDP.

```xml
<udp-mtu>4096</udp-mtu>
```
or, via command line
```
drachtio --mtu 4096
```
or, via environment variables
```
DRACHTIO_UDP_MTU=4096 drachtio
```

::: info Note
Currently has no effect: requests are never switched from UDP to TCP because of their size.
:::

#### blacklist
The drachtio server can use a Redis server to maintain a list of blacklisted IP addresses. The blacklist is a Redis set containing IP addresses, which the server periodically reads.  Incoming SIP messages from a blacklisted IP address are silently discarded.  This is mostly useful in environments such as Kubernetes where modifying iptables is not an option.

The `<blacklist>` element is a child of the `<sip>` element:
```xml
<sip>
  <blacklist>
    <redis-address>127.0.0.1</redis-address>
    <redis-port>6379</redis-port>
    <redis-key>blacklisted-ips</redis-key>
    <refresh-secs>60</refresh-secs>
  </blacklist>
</sip>
```
Or, using Redis sentinels (the server reads the set from a replica discovered via the sentinels):
```xml
<sip>
  <blacklist>
    <redis-sentinels>10.0.0.1:26379,10.0.0.2:26379</redis-sentinels>
    <redis-master>mymaster</redis-master>
    <redis-key>blacklisted-ips</redis-key>
    <refresh-secs>60</refresh-secs>
  </blacklist>
</sip>
```
`redis-key` is required, as is either `redis-address` or `redis-sentinels` (and `redis-master` when using sentinels).  `redis-port` defaults to 6379 and `refresh-secs` defaults to 3600.

::: info Note
A `redis-password` element in the configuration file currently has no effect.  If your Redis server requires a password, set it with the `--blacklist-redis-password` command-line argument or the `DRACHTIO_BLACKLIST_REDIS_PASSWORD` environment variable instead.
:::

or, via command line:
```
drachtio --blacklist-redis-address "127.0.0.1" --blacklist-redis-port 6379 \
  --blacklist-redis-key "blacklisted-ips" --blacklist-refresh-secs 60
```
or, via environment variables:
```
DRACHTIO_BLACKLIST_REDIS_ADDRESS=127.0.0.1 \
DRACHTIO_BLACKLIST_REDIS_PORT=6379 \
DRACHTIO_BLACKLIST_REDIS_KEY=blacklisted-ips \
DRACHTIO_BLACKLIST_REDIS_REFRESH_SECS=60 \
drachtio
```
When the redis address is provided via command line or environment variables, the port defaults to 6379 and the refresh interval to 300 seconds.  If any blacklist redis address is provided via command line or environment variables, the blacklist settings in the configuration file are ignored.

### cdrs section
When set to `true`, the drachtio server sends [call detail records](../srf/call-detail-records.md) to connected applications.  The default is `false`.  This setting can only be provided in the configuration file.

```xml
<cdrs>true</cdrs>
```

### monitoring section
drachtio supports [prometheus](https://prometheus.io) monitoring by optionally exposing a `/metrics` endpoint.  [See here](https://github.com/drachtio/drachtio-server/blob/main/docs/prometheus.md) for a list of the metrics provided.
```xml
<monitoring>
  <prometheus port="9090">127.0.0.1</prometheus>
</monitoring>
```
> Note: the `port` attribute is required.  Specify the address to listen on as the text of the element; use `0.0.0.0` to expose the `/metrics` endpoint on all interfaces.

or, via command line:
```
drachtio --prometheus-scrape-port "9090"
# above implies 0.0.0.0:9090, we can be more explicit
drachtio --prometheus-scrape-port "10.0.1.5:9090"
```
or, via environment variables
```
DRACHTIO_PROMETHEUS_SCRAPE_PORT=9090 drachtio
# or
DRACHTIO_PROMETHEUS_SCRAPE_PORT=10.0.1.5:9090 drachtio
```

### logging section

The `<logging>` section defines where drachtio server will send logging information, including sip traces.

Logging destinations include the console, a named log file on the server, or syslog.  Any or all of them may be used at one time.

#### console

To log output to the console simply include a `<console/>` child element.  Console logging can also be enabled with the `--stdout` command-line argument or the `DRACHTIO_CONSOLE_LOGGING=1` environment variable.

> Note: if neither a log file nor syslog is configured, the server logs to the console.  The `--noconfig` command-line argument causes the server to ignore the logging destinations in the configuration file and log only to the console.

#### syslog

To send log output to a syslog server via UDP, specify the following:
```xml
<syslog>
  <address>127.0.0.1</address>
  <port>514</port>
  <facility>local6</facility>
</syslog>
```
The port defaults to 514, and the facility must be one of `local0` through `local7`.

#### log file

To send log output to a log file on the server, specify the following:
```xml
<file>
  <name>/var/log/drachtio/drachtio.log</name>
  <archive>/var/log/drachtio/archive</archive>
  <size>50</size>
  <maxSize>1000</maxSize>
  <maxFiles>20</maxFiles>
  <auto-flush>true</auto-flush>
</file>
```
The options are as follows:

* `name`: path to the log file
* `archive`: path to a directory where older log files will be archived (default: `archive`)
* `size`: the size (in MB) at which the log file is rotated (default: 50).  The log file is also rotated daily at midnight.
* `maxSize`: the maximum total size (in MB) of archived files to keep (default: 1000)
* `maxFiles`: the maximum number of archived files to keep (default: 100)
* `minSize`: the minimum free space (in MB) to maintain on the filesystem when archiving.  Currently not honored: the server uses an unpredictable value instead, so archived log files may be removed sooner than you expect.  Use `maxSize` and `maxFiles` to control the archive.
* `auto-flush`: if true, log information is written immediately to disk; otherwise log file is buffered and written intermittently (slightly better performance).  Default: true

By default the log file is created with read and write permissions for its owner and group only.  The `--globally-readable-logs` command-line argument leaves the file permissions unchanged instead.

#### loglevel

The overall system log level: 'notice', 'warning', 'error', 'info', or 'debug'.  The default is 'info'.

```xml
<loglevel>info</loglevel>
```
or, via command line
```
drachtio --loglevel info
```
or, via environment variables
```
DRACHTIO_LOGLEVEL=info drachtio
```

> Note: 'info' is the recommended log level for production systems.  At this log level you will get sip traces, which are useful for debugging.

#### sofia-loglevel

The drachtio server uses the [sofia](https://github.com/davehorton/sofia-sip) library internally.  The log level for this library can be set from 0 (minimal) to 9 (extensive).  The default is 1.

```xml
<sofia-loglevel>3</sofia-loglevel>
```
or, via command line
```
drachtio --sofia-loglevel 3
```
or, via environment variables (values 1 through 9)
```
DRACHTIO_SOFIA_LOGLEVEL=3 drachtio
```

## Transport tuning

The following settings tune the behavior of connection-oriented SIP transports (tcp, tls, ws and wss).  They can only be provided as environment variables.

* `DRACHTIO_TPORT_QUEUESIZE`: the queue size (listen backlog) for tcp, tls, ws and wss transports.  The default is 64, and values greater than 1000 are reduced to 1000.
* `DRACHTIO_TPORT_MAX_CONSECUTIVE_TIMEOUTS`: enables detection of dead connections.  After this many consecutive request timeouts on a connection-oriented transport, the server closes the connection so that the next request opens a new one.  The default is 0 (disabled); other values are limited to the range 2 to 1000.
* `DRACHTIO_TPORT_CONTACT_ALIAS`: set to 1 to have in-dialog requests follow a remote peer that reconnects on a new tcp or tls connection, by tracking which connection each peer's Contact address was most recently seen on.  The default is disabled.

## command-line arguments

The `drachtio` executable can accept command-line arguments that specify some configuration parameters.  If provided, the command-line configuration parameters take preference over those specified in the configuration file.

The supported drachtio command-line arguments are:

* `--daemon` detach from the console and run as a daemon process.  Note: the systemd unit file provided with drachtio uses this parameter, with `Type=forking`.
* `--noconfig` ignore the logging destinations in the configuration file, and log to the console
* `--file|-f filename` read configuration from specified file rather than `/etc/drachtio.conf.xml`
* `--user|-u user` run as the named user rather than root.  This only applies when running with `--daemon`.
* `--address address` specify the address to listen on for admin connections
* `--port|-p port` listen for tcp admin connections on the named port
* `--secret secret` the shared secret used for authentication with drachtio applications
* `--tls-port port` listen for tls admin connections on the named port.
* `--contact|-c uri` specifies a listening address/port/protocol.  Multiple instances of this parameter may be provided
* `--external-ip ip-address` specifies an external address that the drachtio server should advertise in the SIP signaling. This parameter applies to the `--contact` parameter that it follows in the command line.
* `--local-net network` specifies the local network (e.g. 10.0.0.0/8) for a contact. This parameter applies to the `--contact` parameter that it follows in the command line.
* `--dns-name name` a dns name that refers to the local server.  Multiple instances may be provided; they are applied to the last `--contact` on the command line.
* `--http-handler url` an HTTP(S) URL of a web callback (or a `tcp://` or `tls://` URI) that will be used for all new incoming requests.  Setting this parameter turns on outbound connections for all SIP request types.
* `--http-method method` either 'GET' (default) or 'POST'
* `--loglevel|-l level` the overall log level to set
* `--sofia-loglevel level` the log level of the sofia library (0-9)
* `--stdout` write log output to console, in addition to any configured log destinations
* `--homer ip-address[:port]` ip address (and optionally port, default 9060) of homer capture server to send to. HEP3 and udp transport will be used
* `--homer-id id` id to use to represent this server when sending messages to homer (required when `--homer` is used)
* `--key-file path` path to TLS key file
* `--cert-file path` path to TLS certificate file
* `--chain-file path` path to TLS certificate chain file
* `--tls-cipherlist list` list of ciphers to support for TLS connections (default: all strong ciphers supported).
* `--min-tls-version version` minimum allowed TLS version for connecting clients (default: 1.0, allowed values: 1.0, 1.1, 1.2)
* `--mtu size` specifies a message size, in bytes, above which outgoing requests are sent over tcp instead of udp.  Currently has no effect (see [udp-mtu](#udp-mtu)).
* `--dh-param path` dhparam file used for inbound tls admin connections.
* `--tcp-keepalive-interval seconds` interval in seconds for TCP keepalives on admin connections (0 to disable)
* `--aggressive-nat-detection` treat the presence of `nat=yes` in a Record-Route or Contact header as an indication that the remote server is behind a NAT
* `--disable-nat-detection` disable NAT detection
* `--prometheus-scrape-port [address:]port` enable Prometheus metrics endpoint on specified port
* `--reject-register-with-no-realm` reject with a 403 any REGISTER request that has an IP address in the host part of the Request-URI.
* `--memory-debug` enable verbose debugging of memory allocations (do not use in production)
* `--always-send-180` always send a 180 Ringing response (after the 100 Trying) when receiving a new INVITE
* `--user-agent-options-auto-respond` auto-respond to OPTIONS requests matching a specific User-Agent.  This argument does not accept a value, so use the configuration file or environment variable instead (see [user-agent-options-auto-respond](#user-agent-options-auto-respond)).
* `--globally-readable-logs` do not restrict the permissions of the log file to its owner and group
* `--blacklist-redis-address address` address of Redis server containing blacklisted IPs
* `--blacklist-redis-port port` port for Redis server (default: 6379)
* `--blacklist-redis-key key` key for Redis set containing blacklisted IPs
* `--blacklist-refresh-secs seconds` how often to refresh blacklisted IPs from Redis (default: 300)
* `--blacklist-redis-sentinels sentinels` comma-separated list of Redis sentinels in ip:port format
* `--blacklist-redis-master name` Redis master name for sentinel
* `--blacklist-redis-password password` password for Redis server
* `--help|-h` print usage information and exit
* `--version|-v` print the drachtio server version to console and exit.

## Environment variables

Most configuration options can also be set via environment variables:

| Variable | Description |
|----------|-------------|
| `DRACHTIO_CONFIG_FILE_PATH` | Path to the configuration file (default: /etc/drachtio.conf.xml) |
| `DRACHTIO_ADMIN_ADDRESS` | Address to listen on for admin connections |
| `DRACHTIO_ADMIN_TCP_PORT` | TCP port for admin connections |
| `DRACHTIO_ADMIN_TLS_PORT` | TLS port for admin connections |
| `DRACHTIO_SECRET` | Shared secret for authentication |
| `DRACHTIO_HTTP_HANDLER_URI` | HTTP callback URL or direct outbound URI (tcp://, tls://) for request handling (all SIP methods, HTTP GET) |
| `DRACHTIO_CONSOLE_LOGGING` | Enable console logging (set to 1) |
| `DRACHTIO_LOGLEVEL` | Log level (debug, info, notice, warning, error) |
| `DRACHTIO_SOFIA_LOGLEVEL` | Sofia SIP library log level (1-9) |
| `DRACHTIO_TCP_KEEPALIVE_INTERVAL` | TCP keepalive interval in seconds for admin connections (0 to disable) |
| `DRACHTIO_AGRESSIVE_NAT_DETECTION` | Enable aggressive NAT detection (set to 1) |
| `DRACHTIO_UDP_MTU` | UDP MTU size (currently has no effect) |
| `DRACHTIO_MEMORY_DEBUG` | Enable memory debugging logging (set to 1) |
| `DRACHTIO_USER_AGENT_OPTIONS_AUTO_RESPOND` | Auto-respond with 200 OK to OPTIONS requests with this User-Agent |
| `DRACHTIO_MIN_TLS_VERSION` | Minimum TLS version (1.0, 1.1, 1.2) |
| `DRACHTIO_TLS_CERT_FILE` | TLS certificate file |
| `DRACHTIO_TLS_CHAIN_FILE` | TLS certificate chain file |
| `DRACHTIO_TLS_KEY_FILE` | TLS key file |
| `DRACHTIO_TLS_DH_PARAM_FILE` | TLS DH parameter file |
| `DRACHTIO_TLS_CIPHER_LIST` | TLS cipher list |
| `DRACHTIO_TLS_VERIFY_CLIENT_CERT` | Verify certificates of remote peers on SIP TLS connections (set to 1) |
| `DRACHTIO_SUPPORT_BEST_EFFORT_TLS` | Enable best-effort TLS (set to 1) |
| `DRACHTIO_LOCAL_DOMAIN` | Reject outbound SIP to specified domain and its subdomains |
| `DRACHTIO_PRESERVE_HEADER_NAMES` | Preserve case of the listed SIP headers (comma-separated) |
| `DRACHTIO_REJECT_REGISTER_WITH_NO_REALM` | Reject REGISTER with an IP address in the Request-URI host (set to 1) |
| `DRACHTIO_HOMER_ADDRESS` | Homer capture server address |
| `DRACHTIO_HOMER_PORT` | Homer capture server port |
| `DRACHTIO_HOMER_ID` | Homer capture agent ID |
| `DRACHTIO_PROMETHEUS_SCRAPE_PORT` | Prometheus metrics port (or address:port) |
| `DRACHTIO_BLACKLIST_REDIS_ADDRESS` | Redis server address for IP blacklist |
| `DRACHTIO_BLACKLIST_REDIS_PORT` | Redis server port |
| `DRACHTIO_BLACKLIST_REDIS_KEY` | Redis key for blacklist set |
| `DRACHTIO_BLACKLIST_REDIS_REFRESH_SECS` | Blacklist refresh interval in seconds |
| `DRACHTIO_BLACKLIST_REDIS_SENTINELS` | Redis sentinels (comma-separated ip:port) |
| `DRACHTIO_BLACKLIST_REDIS_MASTER` | Redis master name for sentinel |
| `DRACHTIO_BLACKLIST_REDIS_PASSWORD` | Redis password |
| `DRACHTIO_TPORT_QUEUESIZE` | Queue size (listen backlog) for tcp/tls/ws/wss transports (default 64, max 1000) |
| `DRACHTIO_TPORT_MAX_CONSECUTIVE_TIMEOUTS` | Close a tcp/tls/ws/wss connection after this many consecutive request timeouts (default 0 = disabled) |
| `DRACHTIO_TPORT_CONTACT_ALIAS` | Have in-dialog requests follow a peer that reconnects (set to 1) |

The [Docker image](running.md#running-in-docker) also supports some additional environment variables that are handled by its entrypoint script.
