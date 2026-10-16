# Advanced Topics

## Outbound connections

The examples so far have illustrated **inbound connections**; that is, a drachtio application establishing a tcp connection to a drachtio server.  These are created by calling [Srf#connect](./api/srf.md#srf-connect):
```js
const Srf = require('drachtio-srf');
const srf = new Srf();

// example of creating inbound connections
srf.connect({
  host: '192.168.1.100',
  port: 9022, 
  secret: 'cymru'
});

srf.on('connect', (err, hp) => {
  if (err) return console.log(`error authenticating: ${err}`);
  console.log(`connected to drachtio listening on ${hp}`);
});
srf.on('error', (err) => console.log(`error connecting: ${err}`));

srf.invite((req, res) => {..});
```
An inbound connection is intended to be a **long lasting** connection: the application connects when the application starts, and that connection is then used to transmit all SIP events and commands as long as the application is running.  

::: info Note
If the connection between the drachtio client and the server is interrupted, it will be automatically reestablished as long as the application has installed a listener for the 'error' event on the Srf instance (see [Reconnection and keep-alive options](#reconnection-and-keep-alive-options) below).
:::

Inbound connections are generally most useful in scenarios when a drachtio server is single-purposed, meaning all SIP requests are handled by a single application.  For example, if a drachtio server is specifically purposed to be a SIP proxy, and all incoming calls are treated by the same application logic, then an inbound connection between the drachtio application and server would probably be preferred.

However, it is also possible for the connections between the drachtio application and the server to be reversed: that is, the drachtio server establishes the connection to a drachtio application on a per-call (more specifically, a per SIP request) basis.  This is called an **outbound connection**, and it requires two things:

1. The drachtio server configuration file must include a [request-handler](../server/configuring.md#request-handlers-section) xml section that maps a specific SIP method type to either an HTTP web callback or directly to the address of a listening application (using a `tcp://` or `tls://` uri), and
2. The drachtio application must call the [Srf#listen](./api/srf.md#srf-listen) method, which causes it to listen for connections from a drachtio server rather than initiate them.

The sequence of events when outbound connections have been enabled are as follows:

1. The drachtio application starts, and begins listening on a specific IP address and port for connections from drachtio servers.
2. An incoming INVITE request (for example) is received by a drachtio server.
3. Because the drachtio server has been configured with a web callback for INVITE request types, an HTTP request (GET by default) is made to the web callback.  Information about the incoming call is passed to the web callback via url parameters in the request.
4. The web callback -- which is a user-supplied web app -- returns a JSON body indicating the ip address or dns name and tcp port where the drachtio application is listening, e.g. `{"action": "route", "data": {"uri": "10.32.100.2:3001"}}`.  (Alternatively, if the request-handler is configured with a `tcp://` or `tls://` uri, no web callback is made and the server connects directly to that address.)
5. The drachtio server retrieves the ip address and port from the response to the web callback and establishes a tcp connection to the drachtio application listening on that address:port.
6. The INVITE information is sent to the drachtio application over this new connection, and the standard drachtio middleware is invoked; e.g. `srf.invite((req, res))`.

```js
const Srf = require('drachtio-srf');
const srf = new Srf();

// example of listening for outbound connections
srf.listen({
  port: 3001, 
  secret: 'cymru'
});

srf.invite((req, res) => {..});
```

From the standpoint of the drachtio application you would write, the code is almost exactly the same other than the call to [Srf#listen](./api/srf.md#srf-listen) instead of [Srf#connect](./api/srf.md#srf-connect) and one other matter related to eventually releasing the connection, which we will describe shortly.

### Mixing inbound and outbound connections

Is it possible to mix inbound and outbound connections?  

Sort of.  Here are the limitations:

1. A drachtio server can have both inbound and outbound connections, but a given SIP method type (e.g. INVITE) will exclusively use one or the other.  Specifically, if there is a `<request-handler>` element with a `sip-method` property set to either the method name or `*`, then outbound connections will be used for all incoming SIP requests of that method type; otherwise inbound connections will be used.
2. A single `Srf` instance must exclusively use only inbound or outbound connections; that is to say that it must call *either* [Srf#connect](./api/srf.md#srf-connect) *or* [Srf#listen](./api/srf.md#srf-listen) but not both.  A single application that wants to use both must create two (or more) Srf instances, or alternatively the functionality can be split into multiple applications.

### Terminating outbound connections

We mentioned above that inbound connections are long-lasting.

Outbound connections are not.  

An outbound connection is established when a specific SIP request arrives, and it is intended to last only until the application has determined that all logic related to that request has been performed. From a practical standpoint, since each new arriving request spawns a new tcp connection, it is important that connections are destroyed when the application logic is complete, so that we don't exhaust file descriptor or other resources on the server.

Because the determination of "when all application logic has complete" is, by definition, something that only the application can know, we require the application to destroy the connection via an explicit call to [Srf#endSession](./api/srf.md#srf-endsession), passing the `req` (or `res`) object, when it is no longer needed.  Typically, an application will call this method when all SIP dialogs or transactions associated with or emanating from the initial SIP request have been destroyed.  

In a simple example of a UAS app connecting an incoming call, for instance, when the BYE that terminates the call is sent or received it would be appropriate to call [Srf#endSession](./api/srf.md#srf-endsession):
```js
srf.invite(async(req, res) => {
  const uas = await srf.createUAS(req, res, {localSdp: mySdp});
  uas.on('destroy', () => srf.endSession(req));
});
```

::: info Note
This method call is a 'no-op' (does nothing) when called on an inbound connection, so it is safe to call in code that may be dealing with an outbound or inbound connection.
:::

If a request arrives over an outbound connection and is not handled by any of the application's middleware (and so is answered with a 404), the connection is ended automatically.

### Sending requests over outbound connections

When an application that uses outbound connections sends a new SIP request with [Srf#request](./api/srf.md#srf-request), it should pass the socket of the connection that the related incoming request arrived on as the first argument, so that the request is sent through the right drachtio server:
```js
srf.message((req, res) => {
  res.send(200);
  srf.request(req.socket, 'sip:alice@example.com', {
    method: 'MESSAGE',
    headers: {'Content-Type': 'text/plain'},
    body: 'got your message'
  });
});
```
(Requests sent within a dialog, and the B-leg INVITE sent by `srf.createB2BUA`, automatically use the correct connection.)

### When to use outbound connections

There are two primary scenarios in which to use outbound connections:

1. When a single drachtio server is going to handle calls controlled by multiple different types of applications.  In this scenario, it can be useful to have a web callback examine the incoming calls and distribute them appropriately to the different drachtio applications based on per-call information.  For example, if we wanted to stand up a drachtio server that multiple customers could utilize (i.e. multi-tenant situation) then outbound connections would allow us to have many different customer applications controlling calls on that server, each applying their own logic.
2. When drachtio applications are going to run in a containerized cluster environment such as Kubernetes, outbound connections can be useful.  In this environment, it can be useful to create a Kubernetes Service for the drachtio cluster, and then use outbound connections to route incoming calls to the public address of the Kubernetes Service which is backed by a cluster of drachtio applications running in Kubernetes pods.  

In general, outbound connections can make it easier to independently scale drachtio servers and groups of drachtio applications, since you do not need to explicitly "tie" drachtio applications to specific servers.

For more information on configuring drachtio server for outbound connections refer to the [drachtio server configuration documentation](../server/configuring.md#request-handlers-section).

## Routing requests to tagged applications

When a drachtio server has several applications connected to it using inbound connections, it normally distributes new incoming requests of a given method among the applications that have registered for that method, in round-robin fashion.  Applications can additionally identify themselves with one or more **tags**, which are supplied when creating the Srf instance:
```js
const Srf = require('drachtio-srf');
const srf = new Srf(['conferencing-app', 'region-east']); // or a single string tag

srf.connect({host: '192.168.1.100', port: 9022, secret: 'cymru'});
```
A web callback configured on the drachtio server can then direct a request to an application with a given tag by returning a response like `{"action": "route", "data": {"tag": "conferencing-app"}}`; the server selects one of the connected applications having that tag (again, in round-robin fashion if more than one).  

Up to 20 tags may be supplied, each a maximum of 32 characters drawn from the characters `a-zA-Z0-9-_+@:`.

## Connecting to multiple drachtio servers

A single Srf instance connects to a single drachtio server.  If an application needs to make inbound connections to more than one drachtio server, it should create one Srf instance per server.  Conversely, when using outbound connections, a single Srf instance that calls [Srf#listen](./api/srf.md#srf-listen) can accept connections from any number of drachtio servers.

## Reconnection and keep-alive options

When using inbound connections, drachtio-srf automatically attempts to reconnect when the connection to the server is lost, provided that the application has a listener for the `error` event.  Each attempt is preceded by a `reconnecting` event, with an object containing the `delay` (in milliseconds) before the attempt and the `attempt` number, and the delay grows with each failed attempt.  A `close` event is emitted when the connection closes.

The reconnect behavior can be tuned by passing a `reconnect` object in the options to `Srf#connect`:
```js
srf.connect({
  host: '192.168.1.100',
  port: 9022,
  secret: 'cymru',
  reconnect: {
    retryMaxDelay: 5000,      // never wait more than 5 seconds between attempts
    maxAttempts: 100,         // give up after 100 attempts
    connectTimeout: 300000    // give up after 5 minutes of trying
  },
  enablePing: true,           // send periodic keep-alive messages to the server
  pingInterval: 30000         // every 30 seconds (default 15000)
});

srf
  .on('error', (err) => console.log(`connection error: ${err}`))
  .on('reconnecting', ({delay, attempt}) => console.log(`reconnect attempt ${attempt} in ${delay}ms`));
```

* `reconnect.retryMaxDelay`: the maximum delay, in milliseconds, between reconnect attempts.  By default there is no maximum.
* `reconnect.maxAttempts`: the maximum number of reconnect attempts.  By default there is no limit.
* `reconnect.connectTimeout`: the total time, in milliseconds, after which to stop trying to reconnect.  By default there is no limit.
* `enablePing`: if true, the application sends a periodic `ping` message to the drachtio server over the connection, which keeps the connection active through intervening NATs and firewalls.
* `pingInterval`: the interval, in milliseconds, between pings (minimum 5000, maximum 300000, default 15000).

## Using TLS to encrypt messages between application and server

You can encrypt the messages between the drachtio server and your application.  This may be useful in situations where applications are running remotely and you prefer to encrypt the control messages as they pass through intervening networks.  Both inbound and outbound connections can use TLS encryption, though the configuration steps are different as described below.

### Securing inbound connections using TLS

To use TLS on inbound connections, simply configure the drachtio server to listen on a specific port for TLS traffic, in addition to (or in place of) TCP traffic.  For example:
```xml
<admin port="9022" tls-port="9023" secret="cymru">127.0.0.1</admin>
```
would cause the server to listen for tcp connections on port 9022 and tls connections on port 9023.

You can also specify the port on the command line:
```bash
drachtio --tls-port 9023
```
In addition to specifying a port to listen for tls traffic, you must specify minimally a server key, a certificate, and a dhparam file.  These are specified in the [tls](../server/configuring.md#tls) element within the 'sip' section of the config file:
```xml
<tls>
    <key-file>/etc/letsencrypt/live/example.org/privkey.pem</key-file>
    <cert-file>/etc/letsencrypt/live/example.org/cert.pem</cert-file>
    <chain-file>/etc/letsencrypt/live/example.org/chain.pem</chain-file>
    <dh-param>/var/local/private/dh4096.pem</dh-param>
</tls>
```
Of course, these can also be specified via the command line as well:
```bash
drachtio --dh-param /var/local/private/dh4096.pem \
  --cert-file /etc/letsencrypt/live/example.org/cert.pem \
  --chain-file /etc/letsencrypt/live/example.org/chain.pem \
  --key-file /etc/letsencrypt/live/example.org/privkey.pem
```
#### drachtio-srf app configuration
On the client side, when connecting to a TLS port the [Srf#connect](./api/srf.md#srf-connect) function call must include a 'tls' object parameter in the options passed:
```js
    srf.connect({
      host: '127.0.0.1',
      port: 9023,
      secret: 'cymru',
      tls: {
        rejectUnauthorized: false
      }
    });
```
Any of the node.js options that can be passed to [tls.connect](https://nodejs.org/api/tls.html#tlsconnectoptions-callback) (including those accepted by [tls.createSecureContext](https://nodejs.org/api/tls.html#tlscreatesecurecontextoptions)) can be passed. Even if you do not need to include any options, you must still pass an empty object as `opts.tls` to tell drachtio-srf to use TLS.

#### Using self-signed certificate on the server
If you are using a self-signed certificate on the server, then you must load that same certificate on the client, as below:
```js
    srf.connect({
      host: '127.0.0.1',
      port: 9023,
      secret: 'cymru',
      tls: {
        ca: fs.readFileSync('server.crt'),
        rejectUnauthorized: false
      }
    });
```
::: warning Warning
Automatic reconnects always use plain TCP, even if you first connected over TLS.  If you use TLS, turn automatic reconnects off with `reconnect: {maxAttempts: 1}` (the first connection counts as an attempt) and reconnect yourself when you receive the `close` event, for example by creating a new Srf instance and connecting again.
:::

### Securing outbound connections using TLS
To use TLS to secure outbound connections, there is no specific configuration needed on the server.  You just need your http request handler to return a uri with a `transport=tls` parameter, e.g.:
```json
{"action": "route", "data": {"uri": "10.32.100.2:8080;transport=tls"}}
```
or, if not using a web callback, configure the request-handler with a `tls://` uri (e.g. `tls://10.32.100.2:8080`).
#### drachtio-srf configuration
On the application side, to listen for TLS connections you will need to modify the [Srf#listen](./api/srf.md#srf-listen) function to pass tls options, which are passed to node.js [tls.createServer](https://nodejs.org/api/tls.html#tlscreateserveroptions-secureconnectionlistener).  Minimally, you must specify a private key and certificate.
```js
  srf.listen({
    port: 8080,
    secret: 'cymru',
    tls: {
      key: fs.readFileSync('server.key'),
      cert: fs.readFileSync('server.crt'),
      rejectUnauthorized: false      
    }
  });
```
