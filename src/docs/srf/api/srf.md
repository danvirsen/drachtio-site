# Srf {#srf}

`Srf` stands for *signaling resource framework*. You create an instance of `Srf`, connect it to a drachtio server, and use it to receive SIP requests, send SIP requests, and create and manage SIP [dialogs](./dialog.md#dialog). `Srf` extends Node.js `EventEmitter`.

## Constructor {#srf-constructor}

```js
new Srf([tags])
```

| Name | Type | Description |
|------|------|-------------|
| `[tags]` | string or Array&lt;string&gt; | One tag, or an array of tags, for this application. When a drachtio server routes incoming requests to applications that connect to it (inbound connections), it can use the tags to pick which application gets a request. Up to 20 tags; each is at most 32 characters, using only `a-zA-Z0-9-_+@:`. If you break these rules, the constructor throws an error. |

Tags are sent to the server when you call [`connect()`](#srf-connect) or [`listen()`](#srf-listen).

The constructor also accepts a connection options object (`new Srf({host, port, secret})`). In that case it connects right away, using the same options as [`connect()`](#srf-connect), and no tags are set.

```js title="Create an Srf instance and connect to a drachtio server"
const Srf = require('drachtio-srf');
const srf = new Srf();

srf.connect({
  host: '192.168.32.5',
  port: 9022,
  secret: 'cymru'
});
```

```js title="Create an Srf instance and listen for outbound connections"
const Srf = require('drachtio-srf');
const srf = new Srf();

srf.listen({
  port: 3000,
  secret: 'cymru'
});
```

```js title="Create an Srf instance with a tag used to route requests"
const Srf = require('drachtio-srf');
const srf = new Srf('conference-app');

srf.connect({
  host: '192.168.32.5',
  port: 9022,
  secret: 'cymru'
});
```

## Connection methods {#srf-connection-methods}

### connect() {#srf-connect}

```js
srf.connect(opts, [callback])
```

Opens an *inbound* connection: the application connects to a drachtio server, which is listening for application connections (by default on port 9022). If the connection drops, the library reconnects automatically with exponential backoff.

| Name | Type | Description |
|------|------|-------------|
| `opts` | Object | Connection options. |
| `opts.host` | string | IP address or DNS name of the drachtio server. |
| `[opts.port]` | number | Port the server listens on for application connections. Always set it; drachtio server's default is 9022. |
| `opts.secret` | string | Shared secret used to authenticate to the server. |
| `[opts.tls]` | Object | If present, the connection uses TLS. This object is passed to Node's [`tls.connect()`](https://nodejs.org/api/tls.html#tlsconnectoptions-callback), so it accepts any of those options (for example `ca`, `cert`, `key`, `rejectUnauthorized`). The server must have a TLS admin port configured; see [Configuring drachtio server](../../server/configuring.md). |
| `[opts.reconnect]` | Object | Controls automatic reconnection. |
| `[opts.reconnect.retryMaxDelay]` | number | Upper limit, in milliseconds, on the delay between reconnect attempts. Without it the delay keeps growing: it starts at about 150 ms and is multiplied by 1.7 after each attempt. |
| `[opts.reconnect.maxAttempts]` | number | Stop trying to reconnect after this many attempts. Default: no limit. |
| `[opts.reconnect.connectTimeout]` | number | Stop trying to reconnect once this many milliseconds of retry delay have built up. Default: no limit. |
| `[opts.enablePing]` | boolean | If `true`, the application sends periodic `ping` messages to the server to keep the connection alive. This only happens when the server is version v0.8.2 or later. |
| `[opts.pingInterval]` | number | Interval between pings in milliseconds. Must be between 5000 and 300000. Default: 15000. |
| `[opts.logger]` | function | Called with the raw text of messages exchanged with the server. Sent messages are always passed to it; received messages only when `DEBUG=drachtio:agent` debugging is enabled. |
| `[callback]` | function | Registered as a listener for the [`connect`](#srf-event-connect) event, so it is called as `(err, hostport, serverVersion, localHostports)`. |

Don't chain calls on the return value; listen for events on `srf` itself (for example `srf.on('connect', ...)`).

::: warning TLS and automatic reconnection
When the library reconnects automatically, it uses plain TCP, even if your first connection used TLS. If you use TLS, turn automatic reconnects off with `reconnect: {maxAttempts: 1}` and reconnect yourself on the [`close`](#srf-event-close) event.
:::

```js
srf.connect({host: '127.0.0.1', port: 9022, secret: 'cymru'});

srf.on('connect', (err, hostport) => {
  if (err) return console.error(`error connecting: ${err}`);
  console.log(`connected to drachtio server listening on ${hostport}`);
});
srf.on('error', (err) => console.error(`connection error: ${err.message}`));
```

### listen() {#srf-listen}

```js
srf.listen(opts, [callback])
```

Listens for *outbound* connections: the application runs a TCP (or TLS) server, and drachtio server connects to it when a new request arrives. See [Advanced topics](../advanced-topics.md) for how outbound connections work.

| Name | Type | Description |
|------|------|-------------|
| `opts` | Object | Listen options. |
| `opts.port` | number | TCP port to listen on. |
| `[opts.host]` | string | Address to bind to. If you leave it out, Node.js listens on all addresses. |
| `opts.secret` | string | Shared secret the drachtio server must present. |
| `[opts.tls]` | Object | If present, the application runs a TLS server. This object is passed to Node's [`tls.createServer()`](https://nodejs.org/api/tls.html#tlscreateserveroptions-secureconnectionlistener), so it accepts those options (for example `key` and `cert`). |
| `[opts.server]` | `net.Server` | An existing server to use instead of creating one. When you supply it, `port`, `host` and `tls` are ignored. |
| `[opts.enablePing]` | boolean | Same as for [`connect()`](#srf-connect). |
| `[opts.pingInterval]` | number | Same as for [`connect()`](#srf-connect). |
| `[opts.logger]` | function | Same as for [`connect()`](#srf-connect). |
| `[callback]` | function | Registered as a listener for the [`listening`](#srf-event-listening) event. |

**Returns:** the `net.Server` (or `tls.Server`) that is listening.

Each time a drachtio server connects and authenticates, `srf` emits a [`connect`](#srf-event-connect) event.

### disconnect() {#srf-disconnect}

```js
srf.disconnect([socket])
```

Closes the connection to a drachtio server. If you pass a `socket`, that socket is closed, and any requests still waiting for a response on it fail with an `ECONNLOST` error. <Badge type="info" text="next release" /> If you leave it out, the default (first) connection is closed. Once you call `disconnect()`, an inbound connection is not re-established automatically.

**Returns:** `undefined`.

### endSession() {#srf-endsession}

```js
srf.endSession(msg)
```

Closes the outbound connection that a request or response arrived on. Use this when the application is [listening](#srf-listen) for outbound connections and has finished with a call.

::: info Note
This only does something for outbound connections. If the application made an inbound connection with `connect()`, `endSession()` does nothing.
:::

| Name | Type | Description |
|------|------|-------------|
| `msg` | [Request](./request.md#request) or [Response](./response.md#response) | A request or response that arrived on the connection you want to close. |

**Returns:** `undefined`.

```js
srf.listen({port: 3001, secret: 'cymru'});

srf.invite(async(req, res) => {
  const uas = await srf.createUAS(req, res, {localSdp: mySdp});
  uas.on('destroy', () => srf.endSession(req));
});
```

## Handling incoming requests {#srf-request-handlers}

### srf.&lt;method&gt;() {#srf-method-handlers}

```js
srf.<method>(...handlers)
```

`Srf` has one method for each SIP request type. Each registers handlers for incoming requests of that type that arrive **outside** of an existing dialog. Requests that arrive *within* a dialog go to the matching [Dialog](./dialog.md#dialog) object as events.

| Method | Handles |
|--------|---------|
| <span id="srf-invite"></span>`srf.invite(handler)` | INVITE |
| <span id="srf-register"></span>`srf.register(handler)` | REGISTER |
| <span id="srf-subscribe"></span>`srf.subscribe(handler)` | SUBSCRIBE |
| <span id="srf-notify"></span>`srf.notify(handler)` | NOTIFY |
| <span id="srf-options"></span>`srf.options(handler)` | OPTIONS |
| <span id="srf-info"></span>`srf.info(handler)` | INFO |
| <span id="srf-message"></span>`srf.message(handler)` | MESSAGE |
| <span id="srf-publish"></span>`srf.publish(handler)` | PUBLISH |
| <span id="srf-refer"></span>`srf.refer(handler)` | REFER |
| <span id="srf-update"></span>`srf.update(handler)` | UPDATE |
| <span id="srf-prack"></span>`srf.prack(handler)` | PRACK |
| <span id="srf-bye"></span>`srf.bye(handler)` | BYE (outside of a known dialog) |
| <span id="srf-ack"></span>`srf.ack(handler)` | ACK (outside of a known dialog) |
| <span id="srf-cancel"></span>`srf.cancel(handler)` | CANCEL. You don't normally need this: an incoming CANCEL is reported as the pending INVITE's [`cancel`](./request.md#request-event-cancel) event, so this handler is not called. |

Each of these is the same as calling [`srf.use('<method>', ...handlers)`](#srf-use). A handler is called as `(req, res, next)`, where `req` is a [Request](./request.md#request) and `res` is a [Response](./response.md#response). You can pass several handlers; they run in order, and each one passes control to the next by calling `next()`. Registering a handler for a method also tells the drachtio server to send requests of that method to this application.

If no handler sends a final response, the framework sends `404 Not Found` (except for ACK and UPDATE, which get no response, and PRACK, which gets `200 OK`).

```js
srf.options((req, res) => res.send(200));

srf.invite((req, res) => {
  // ...
});
```

### use() {#srf-use}

```js
srf.use([method], ...handlers)
```

Installs SIP middleware. With no `method`, the middleware runs for every incoming request. With a `method`, it runs only for requests of that method, and the drachtio server is told to send requests of that method to this application.

| Name | Type | Description |
|------|------|-------------|
| `[method]` | string | SIP method, in lower case (for example `'register'`). Default: all methods. |
| `handlers` | function or Array&lt;function&gt; | One or more middleware functions, called as `(req, res, next)`. A function that takes four arguments, `(err, req, res, next)`, is an error handler: it runs only after an earlier handler calls `next(err)`. |

If an error reaches the end of the chain and no final response has been sent, the framework sends a final response with `err.status` (or 500).

See [Middleware](../middleware.md) for more.

```js title="Install middleware to authenticate incoming REGISTER requests"
const Srf = require('drachtio-srf');
const srf = new Srf();
const digestAuth = require('drachtio-mw-digest-auth');
const regParser = require('drachtio-mw-registration-parser');

srf.connect({/* ... */});

const challenge = digestAuth({
  realm: 'sip.drachtio.org',
  passwordLookup: (username, realm, callback) => {
    // ..look up the password for username in realm
    return callback(null, password);
  }
});

srf.use('register', challenge);
srf.use('register', regParser);
srf.register((req, res) => {
  // if we get here the request is authenticated
  // and a 'registration' property has been added to 'req'
  res.send(200, {
    headers: {
      'Expires': req.registration.expires
    }
  });
});
```

### unregisterForMessages() {#srf-unregisterformessages}

```js
srf.unregisterForMessages(method)
```

Tells the connected drachtio server(s) to stop sending new requests of `method` to this application (inbound connections only). Pass the method the same way it was registered: lower case, for example `'invite'`. Throws if no handler was ever registered for that method.

### reregisterForMessages() {#srf-reregisterformessages}

```js
srf.reregisterForMessages(method)
```

Undoes [`unregisterForMessages()`](#srf-unregisterformessages): tells the server to start sending requests of `method` to this application again. Throws if the method is already registered.

## Creating dialogs {#srf-creating-dialogs}

See [SIP Dialogs](../sip-dialogs.md) for a step-by-step guide.

### createUAS() {#srf-createuas}

```js
srf.createUAS(req, res, [opts], [callback])
```

Creates a SIP dialog acting as a UAS (user agent server). It answers an incoming INVITE with `200 OK`, or any other dialog-creating request (for example SUBSCRIBE) with `202 Accepted`.

The [Dialog](./dialog.md#dialog) is returned as soon as the 200 OK has been sent; it does not wait for the ACK. To find out when the ACK arrives, listen for the dialog's [`ack`](./dialog.md#dialog-event-ack) event.

| Name | Type | Description |
|------|------|-------------|
| `req` | [Request](./request.md#request) | The incoming request. |
| `res` | [Response](./response.md#response) | The response object for that request. |
| `[opts]` | Object | Options. |
| `[opts.localSdp]` | string or function | SDP to send in the 200 OK. You can also pass a function that returns the SDP, or a Promise that resolves to it; the function is called just before the response is sent. |
| `[opts.headers]` | Object | SIP headers to add to the 200 OK (or 202). |
| `[opts.dialogStateEmitter]` | EventEmitter | If this emitter has `stateChange` listeners, it gets [dialog state events](#srf-dialog-state-events) (RFC 4235) for an INVITE dialog. |
| `[callback]` | function | Called as `(err, dialog)`. |

**Returns:** a Promise that resolves to the [Dialog](./dialog.md#dialog) if no callback is given; otherwise the `Srf` instance.

**Errors:** fails with [`SipError`](./siperror.md#siperror) `487` (and sets `req.canceled = true`) if the caller sends CANCEL before the answer goes out. Fails with an `Error` if the request has no Contact header, or if sending the response fails.

```js title="Returning a Promise"
srf.invite((req, res) => {
  const mySdp = '...'; // SDP we want to answer with in the 200 OK
  srf.createUAS(req, res, {localSdp: mySdp})
    .then((uas) => {
      console.log(`dialog established, remote uri is ${uas.remote.uri}`);
      uas.on('destroy', () => console.log('caller hung up'));
    })
    .catch((err) => console.log(`Error establishing dialog: ${err}`));
});
```

```js title="Using a callback and adding custom headers"
srf.invite((req, res) => {
  const mySdp = '...';
  srf.createUAS(req, res, {
    localSdp: mySdp,
    headers: {
      'User-Agent': 'drachtio/iechyd-da',
      'X-Linked-UUID': '1e2587c'
    }
  }, (err, uas) => {
    if (err) return console.log(`Error creating dialog: ${err}`);
    console.log(`dialog established, local tag is ${uas.sip.localTag}`);
    uas.on('destroy', () => console.log('caller hung up'));
  });
});
```

### createUAC() {#srf-createuac}

```js
srf.createUAC(uri, opts, [progressCallbacks], [callback])
```

Creates a SIP dialog acting as a UAC (user agent client): it sends an INVITE (or SUBSCRIBE) and returns a [Dialog](./dialog.md#dialog) when a success response arrives. You can also call it as `createUAC(opts, ...)` with the request URI in `opts.uri`.

| Name | Type | Description |
|------|------|-------------|
| `uri` | string | Request URI: a full SIP URI, or `host[:port]`. If you pass something that is not a valid SIP URI and contains no `@`, it is changed to `sip:[calledNumber@]host`. If you use a `sips:` URI, the From header that `callingNumber` builds also uses `sips:`. |
| `opts` | Object | Options. |
| `[opts.uri]` | string | Request URI, when you call `createUAC(opts, ...)` without the `uri` argument. |
| `[opts.method]` | string | `'INVITE'` (default) or `'SUBSCRIBE'`. Any other value throws an error. |
| `[opts.localSdp]` | string | SDP to offer in the INVITE. If you leave it out for an INVITE, the call is a *third-party call control (3pcc)* call, also called a late offer; see `opts.noAck`. |
| `[opts.headers]` | Object | SIP headers to add to the request. |
| `[opts.callingNumber]` | string | Sets the From header to `sip:<callingNumber>@localhost` (and the Contact header to the same value, unless you provide a Contact). The drachtio server replaces `localhost` with its own SIP address. This is ignored if `opts.headers` already contains a From header. |
| `[opts.callingName]` | string | Display name for the From header that `callingNumber` builds. |
| `[opts.calledNumber]` | string | User part to add when `uri` is only a host or address. |
| `[opts.proxy]` | string | Send the request through this outbound proxy, given as a full SIP URI or `address[:port]`. |
| `[opts.auth]` | Object or function | Credentials to use if the far end challenges the request with 401 or 407: either `{username, password}`, or a function called as `(req, res, callback)` (the request that was sent and the challenge response) that must call `callback(err, username, password)`. The credentials are stored on the dialog and reused for in-dialog requests. |
| `[opts.auth.username]` | string | SIP username. |
| `[opts.auth.password]` | string | SIP password. |
| `[opts.followRedirects]` | boolean | If `true`, a 3xx response with a Contact header makes the library send a new request to the first Contact URI, up to 4 redirects. Default: `false`. |
| `[opts.keepUriOnRedirect]` | boolean | Used with `followRedirects`. On redirect, keep the original request URI and send the request *through* the Contact address (used as `proxy`) instead of changing the request URI. |
| `[opts.noAck]` | boolean | Only for a 3pcc INVITE (no `localSdp`). If `true`, the library does not ACK the 200 OK. Instead it resolves with `{sdp, ack, destroy, res}`: `sdp` is the offer from the far end; call `ack(localSdp)` to send the ACK with your answer, and it returns a Promise that resolves to the [Dialog](./dialog.md#dialog); call `destroy()` instead to ACK and then BYE the call. If `noAck` is not `true`, the 200 OK is ACKed straight away with a copy of the remote SDP set to `a=recvonly`, and the Dialog is returned as usual. |
| `[opts.dialogStateEmitter]` | EventEmitter | If this emitter has `stateChange` listeners, it gets [dialog state events](#srf-dialog-state-events) (RFC 4235) for an INVITE. |
| `[progressCallbacks]` | Object | Callbacks that report call progress. |
| `[progressCallbacks.cbRequest]` | function | Called as `(err, req)` once the request has been sent; `req` is the [Request](./request.md#request) as it was sent. Keep it if you might need to call `req.cancel()` later. |
| `[progressCallbacks.cbProvisional]` | function | Called as `(provisionalRes)` for each provisional (1xx) [Response](./response.md#response). |
| `[callback]` | function | Called as `(err, dialog)`. |

You can also pass the progress callbacks as separate arguments: `createUAC(uri, opts, cbRequest, cbProvisional, callback)`.

**Returns:** a Promise that resolves to the [Dialog](./dialog.md#dialog) (or to the `{sdp, ack, destroy, res}` object described under `opts.noAck`) if no callback is given; otherwise the `Srf` instance.

**Errors:**

- A final response other than 2xx fails with a [`SipError`](./siperror.md#siperror) whose `status` and `reason` come from that response, and whose `res` property holds the [Response](./response.md#response).
- A 200 OK without a Contact header fails with `SipError` 500 `'No Contact header in response'`.
- If the connection to drachtio server is lost while the request is pending, the call fails with an `Error` whose `code` is `'ECONNLOST'`. <Badge type="info" text="next release" />
- If sending fails, the error has a `code` (see [Request failure codes](./request.md#request-error-codes)).

Behavior to be aware of:

- Reliable provisional responses (those with an `RSeq` header) are acknowledged with PRACK automatically.
- If the far end sends an UPDATE before the call is answered, the library answers it with `200 OK` carrying the original `localSdp`.

```js title="Returning a Promise"
const mySdp = '...'; // SDP we want to offer
srf.createUAC('sip:1234@10.10.100.1', {localSdp: mySdp})
  .then((uac) => {
    console.log(`dialog established, call-id is ${uac.sip.callId}`);
    uac.on('destroy', () => console.log('called party hung up'));
  })
  .catch((err) => {
    console.error(`INVITE rejected with status: ${err.status}`);
  });
```

```js title="Using a callback"
srf.createUAC('sip:1234@10.10.100.1', {localSdp: mySdp},
  (err, uac) => {
    if (err) return console.log(`INVITE rejected with status: ${err.status}`);
    uac.on('destroy', () => console.log('called party hung up'));
  });
```

```js title="Canceling a request after sending it"
const Srf = require('drachtio-srf');
const srf = new Srf();
const assert = require('assert');

let inviteSent;
srf.createUAC('sip:1234@10.10.100.1', {localSdp: mySdp},
  {
    cbRequest: (err, reqSent) => { inviteSent = reqSent; }
  })
  .then((uac) => {
    // unexpected, in this case
    console.log('dialog established before we could cancel');
  })
  .catch((err) => {
    assert(err.status === 487); // the expected final response after a CANCEL
  });

// cancel the request after 0.5s
setTimeout(() => {
  if (inviteSent) inviteSent.cancel();
}, 500);
```

```js title="Late offer (3pcc) with noAck"
const {sdp, ack} = await srf.createUAC('sip:1234@10.10.100.1', {noAck: true});
const answer = await getAnswerSomehow(sdp);  // e.g. from a media server
const uac = await ack(answer);               // sends ACK with our SDP, resolves with the Dialog
```

### createB2BUA() {#srf-createb2bua}

```js
srf.createB2BUA(req, res, uri, [opts], [progressCallbacks], [callback])
```

Creates a back-to-back user agent (B2BUA): a pair of dialogs, `{uas, uac}`. The UAS dialog faces the caller (the A leg) and the UAC dialog faces the callee (the B leg). The library first sends an INVITE on the B leg and, by default, relays provisional and failure responses back to the A leg. When the B leg answers, it answers the A leg. You can also call it as `createB2BUA(req, res, opts, ...)` with the URI in `opts.uri`.

| Name | Type | Description |
|------|------|-------------|
| `req` | [Request](./request.md#request) | The incoming INVITE (A leg). |
| `res` | [Response](./response.md#response) | The response object for that request. |
| `uri` | string | SIP URI or `address[:port]` for the B leg INVITE. |
| `[opts]` | Object | Options. Every [`createUAC()`](#srf-createuac) option also applies to the B leg (for example `proxy`, `auth`, `followRedirects`, `keepUriOnRedirect`, `dialogStateEmitter`); the method is always taken from `req`. |
| `[opts.headers]` | Object | SIP headers to add to the B leg INVITE. |
| `[opts.responseHeaders]` | Object or function | SIP headers to add to every response sent on the A leg (except 100 Trying). If you pass a function, it is called as `(uacRes, headers)`: `uacRes` is the B leg response being relayed, and `headers` are the headers already set (for example through `proxyResponseHeaders`). It must return an object of headers to add. |
| `[opts.localSdpB]` | string or function | SDP to offer on the B leg. Default: the SDP in the A leg INVITE (`req.body`). If the A leg INVITE has no SDP (or `opts.noAck` is set), this is a 3pcc (late offer) call. In that case a function `localSdpB(sdp)` is called with the SDP from the caller's ACK and must return the SDP (or a Promise of it) to send in the B leg ACK. |
| `[opts.localSdpA]` | string or function | SDP to send to the A leg in 18x and 200 responses. If you pass a function, it is called as `(sdp, res)` with the SDP and the response received from the B leg, and must return the SDP or a Promise that resolves to it. Default: the SDP from the B leg is passed through unchanged. |
| `[opts.proxyRequestHeaders]` | Array&lt;string&gt; | Names of headers to copy unchanged from the A leg INVITE to the B leg INVITE. If the first entry is `'all'`, every header is copied except Via, From, To, Call-ID, CSeq, Contact, Content-Length and Content-Type. After `'all'`, entries of the form `'-Header-Name'` leave out that header. |
| `[opts.proxyResponseHeaders]` | Array&lt;string&gt; | Names of headers to copy unchanged from B leg responses to A leg responses. Accepts `'all'` and `'-Header-Name'` entries in the same way. |
| `[opts.passFailure]` | boolean | If `true`, a failure on the B leg is passed back to the A leg as a final response. Set it to `false` if you want to try another destination. Default: `true`. |
| `[opts.passProvisionalResponses]` | boolean | If `true`, provisional responses (greater than 101) from the B leg are passed back to the A leg. Default: `true`. |
| `[opts.noAck]` | boolean | Forces 3pcc (late offer) handling on the B leg, even when an offer is available. |
| `[progressCallbacks]` | Object | Call-progress callbacks. |
| `[progressCallbacks.cbRequest]` | function | Called as `(err, req)` once the B leg INVITE has been sent. |
| `[progressCallbacks.cbProvisional]` | function | Called as `(provisionalRes)` for each provisional response on the B leg. |
| `[progressCallbacks.cbFinalizedUac]` | function | Called as `(uac)` as soon as the B leg has answered and its Dialog exists, before the A leg is answered. Not called for 3pcc calls. |
| `[callback]` | function | Called as `(err, {uac, uas})`. |

**Returns:** a Promise that resolves to `{uac, uas}` if no callback is given; otherwise the `Srf` instance. On success, `uas.other` refers to `uac` and `uac.other` refers to `uas`.

Behavior to be aware of:

- If the A leg is canceled, the library sends `487` on the A leg and CANCELs the B leg, copying any `Reason` and `X-Reason` headers onto it. The Promise then fails with a `SipError` 487.
- If the A leg sends an UPDATE before the call is answered, it gets 200 OK with the SDP most recently sent to the A leg, or 500 if no SDP has been sent yet.
- When the A leg uses reliable provisional responses (`100rel`), the library waits briefly for PRACKs that are still outstanding before it sends the 200 OK.
- Requests that arrive on the B leg before the A leg ACK arrives are held, and handled once the ACK comes in.
- If the A leg fails after the B leg has answered, the B leg is torn down.
- The From and To details (`callingNumber`, `callingName`, `calledNumber`) are copied from the A leg, unless `opts.headers` provides From or To headers.

```js title="Simple B2BUA"
srf.invite((req, res) => {
  srf.createB2BUA(req, res, 'sip:1234@10.10.100.1', {localSdpB: req.body})
    .then(({uas, uac}) => {
      console.log('call connected');

      // when one side hangs up, hang up the other
      uas.on('destroy', () => uac.destroy());
      uac.on('destroy', () => uas.destroy());
    })
    .catch((err) => console.log(`call failed to connect: ${err}`));
});
```

```js title="Use opts.passFailure to try a fallback URI on failure"
function endCall(dlg1, dlg2) {
  dlg1.on('destroy', () => dlg2.destroy());
  dlg2.on('destroy', () => dlg1.destroy());
}

srf.invite(async(req, res) => {
  try {
    const {uas, uac} = await srf.createB2BUA(req, res, 'sip:1234@10.10.100.1',
      {localSdpB: req.body, passFailure: false});
    return endCall(uas, uac);
  } catch (err) {
    // give up unless we got a SIP failure response and the caller did not hang up
    if (!(err instanceof Srf.SipError) || err.status === 487) {
      if (!res.finalResponseSent) res.send(480);
      return;
    }
    console.log(`failed connecting to primary, will try backup: ${err}`);
  }
  try {
    const {uas, uac} = await srf.createB2BUA(req, res, 'sip:1234@10.10.100.2', {localSdpB: req.body});
    endCall(uas, uac);
  } catch (err) {
    console.log(`failed connecting to backup uri: ${err}`);
  }
});
```

```js title="B2BUA with a media proxy using rtpengine"
const Srf = require('drachtio-srf');
const srf = new Srf();
const config = require('config');
const Client = require('rtpengine-client').Client;
const rtpengine = new Client();

srf.connect(config.get('drachtio'));

// when either side hangs up, hang up the other and free the rtpengine resources
function endCall(dlg1, dlg2, details) {
  [dlg1, dlg2].forEach((dlg) => {
    dlg.on('destroy', () => {
      (dlg === dlg1 ? dlg2 : dlg1).destroy();
      rtpengine.delete(config.get('rtpengine'), details);
    });
  });
}

// returns a Promise that resolves with the SDP to send to the A leg in the 18x/200 answer
function getSdpA(details, remoteSdp, res) {
  return rtpengine.answer(config.get('rtpengine'), Object.assign(details, {
    'sdp': remoteSdp,
    'to-tag': res.getParsedHeader('To').params.tag
  }))
    .then((response) => {
      if (response.result !== 'ok') throw new Error(`Error calling answer: ${response['error-reason']}`);
      return response.sdp;
    });
}

// handle incoming invite
srf.invite((req, res) => {
  const from = req.getParsedHeader('From');
  const details = {'call-id': req.get('Call-Id'), 'from-tag': from.params.tag};

  rtpengine.offer(config.get('rtpengine'), Object.assign(details, {'sdp': req.body}))
    .then((rtpResponse) => {
      if (rtpResponse && rtpResponse.result === 'ok') return rtpResponse.sdp;
      throw new Error('rtpengine failure');
    })
    .then((sdpB) => {
      return srf.createB2BUA(req, res, config.get('uri'), {
        localSdpB: sdpB,
        localSdpA: getSdpA.bind(null, details)
      });
    })
    .then(({uas, uac}) => {
      console.log('call connected with media proxy');
      return endCall(uas, uac, details);
    })
    .catch((err) => console.log(`Error proxying call with media: ${err}`));
});
```

### Dialog state events (RFC 4235) {#srf-dialog-state-events}

If you pass an `EventEmitter` with at least one `stateChange` listener as `opts.dialogStateEmitter` to `createUAS`, `createUAC` or `createB2BUA`, the library emits `stateChange` events as an INVITE dialog moves through its states. You can use them, for example, to build RFC 4235 `dialog` event NOTIFYs. Each event carries one object, and the same object is updated in place as the state changes:

| Property | Description |
|----------|-------------|
| `id` | A unique id generated for this dialog. |
| `state` | One of the [`Srf.DialogState`](#srf-dialogstate) values: `'trying'`, `'proceeding'`, `'early'`, `'confirmed'`, `'terminated'`, `'rejected'`, `'cancelled'`. |
| `direction` | [`Srf.DialogDirection`](#srf-dialogdirection) value: `'initiator'` or `'recipient'`. |
| `aor` | `user@host` of the party the state is reported for (taken from the From header of an incoming INVITE, or the To header of an outgoing one). |
| `callId` | SIP Call-ID. |
| `localTag`, `remoteTag` | Dialog tags, once they are known. |

## Proxying and sending requests {#srf-proxying-and-requests}

### proxyRequest() {#srf-proxyrequest}

```js
srf.proxyRequest(req, [destination], [opts], [callback])
```

Proxies an incoming request. See [SIP Proxy](../sip-proxy.md).

| Name | Type | Description |
|------|------|-------------|
| `req` | [Request](./request.md#request) | The incoming request. |
| `[destination]` | string or Array&lt;string&gt; | One destination (a SIP URI, or `address[:port]`, which gets a `sip:` prefix), or a list of them. Default: the request URI of `req`. |
| `[opts]` | Object | Options. |
| `[opts.forking]` | string | `'sequential'` (default) tries the destinations one at a time. `'simultaneous'` forks to all of them in parallel. |
| `[opts.remainInDialog]` | boolean | If `true`, adds a Record-Route header so the application stays in the signaling path for the rest of the dialog, including the closing BYE. `recordRoute` and `path` are accepted as aliases. Default: `false`. |
| `[opts.provisionalTimeout]` | string | How long to wait for a provisional response from a destination before trying the next one, for example `'1500ms'` or `'2s'`. |
| `[opts.finalTimeout]` | string | How long to wait for a final response from a destination before canceling it and trying the next one. Same syntax as `provisionalTimeout`. |
| `[opts.followRedirects]` | boolean | If `true`, a 3xx response is handled by sending a new request to the Contact it returns. If `false`, the 3xx is passed back upstream. Default: `false`. |
| `[opts.headers]` | Object | SIP headers sent to the drachtio server along with the proxy instruction, to apply to the proxied request. |
| `[callback]` | function | Called as `(err, results)`. |

**Returns:** a Promise that resolves to `results` if no callback is given; otherwise the `Srf` instance.

`results` looks like this:

```js
{
  connected: true,          // true if the final status was 200
  finalStatus: 200,
  finalResponse: {time, status, msg},
  responses: [              // one entry per destination tried
    {address: '10.0.0.1', port: 5060, msgs: [{time, status, msg}, /* ... */]}
  ]
}
```

```js title="Proxy with options"
srf.invite((req, res) => {
  srf.proxyRequest(req, ['sip.example1.com', 'sip.example2.com'], {
    recordRoute: true,
    followRedirects: true,
    provisionalTimeout: '2s'
  }).then((results) => {
    console.log(JSON.stringify(results));
    // {connected: true, finalStatus: 200, finalResponse:{..}, responses: [..]}
  });
});
```

### request() {#srf-request}

```js
srf.request([socket], uri, opts, [callback])
```

Sends a SIP request outside of a dialog. You can also call it as `request(opts, [callback])` with the URI in `opts.uri`.

| Name | Type | Description |
|------|------|-------------|
| `[socket]` | `net.Socket` | The drachtio server connection to send the request on. Default: the first connected server. |
| `uri` | string | Request URI. |
| `opts` | Object | Options. |
| `opts.method` | string | SIP method. Required. |
| `[opts.headers]` | Object | SIP headers to add to the request. |
| `[opts.body]` | string | Message body. |
| `[opts.proxy]` | string | Send the request through this outbound proxy (full SIP URI or `address[:port]`). |
| `[opts.auth]` | Object or function | Credentials used if the request is challenged: `{username, password}`, or a function `(req, res, callback)` as described for [`createUAC()`](#srf-createuac). |
| `[callback]` | function | Called as `(err, req)`, where `req` is the [Request](./request.md#request) that was sent. |

**Returns:** a Promise that resolves to the [Request](./request.md#request) that was sent if no callback is given; otherwise the `Srf` instance. To get the response, listen for the request's [`response`](./request.md#request-event-response) event. If you send an INVITE this way, you must ACK it yourself by calling the `ack` function passed to that event.

If the request could not be sent, the error has a [`code`](./request.md#request-error-codes).

```js title="Send an OPTIONS ping"
srf.connect({host: '127.0.0.1', port: 9022, secret: 'cymru'});

srf.on('connect', (err, hp) => {
  if (err) return console.log(`Error connecting: ${err}`);
  console.log(`connected to server listening on ${hp}`);
  setInterval(optionsPing, 10000);
});

function optionsPing() {
  srf.request('sip:tighthead.drachtio.org', {
    method: 'OPTIONS',
    headers: {
      'Subject': 'OPTIONS Ping'
    }
  }, (err, req) => {
    if (err) return console.log(`Error sending OPTIONS: ${err}`);
    req.on('response', (res) => {
      console.log(`Response to OPTIONS ping: ${res.status}`);
    });
  });
}
```

## Other methods {#srf-other-methods}

### findDialogById() {#srf-finddialogbyid}

```js
srf.findDialogById(stackDialogId)
```

Returns the active [Dialog](./dialog.md#dialog) with the given dialog id ([`dialog.id`](./dialog.md#dialog-properties), which is the same as the `stackDialogId` of its messages), or `undefined` if there is none.

### findDialogByCallIDAndFromTag() {#srf-finddialogbycallidandfromtag}

```js
srf.findDialogByCallIDAndFromTag(callId, tag)
```

Returns the active [Dialog](./dialog.md#dialog) with the given SIP Call-ID and From tag, or `undefined` if there is none.

### set() / get() {#srf-set}

```js
srf.set(name, value)
srf.get(name)
```

<span id="srf-get"></span>Store and read application settings.

## Properties {#srf-properties}

| Property | Description |
|----------|-------------|
| <span id="srf-locals"></span>`srf.locals` | An object for application-wide data. It is empty to begin with. |
| <span id="srf-idle"></span>`srf.idle` | (read-only) `true` when no requests, SIP transactions, or ACK/PRACKs are waiting on any server connection. Useful for a graceful shutdown. |

## Static properties {#srf-static-properties}

### Srf.parseUri {#srf-parseuri}

A function that parses a SIP URI string into its parts. For a `sip:` or `sips:` URI it returns `{family, scheme, user, password, host, port, params, headers}`. For a `tel:` URI it returns `{scheme, number, context, params}`. It returns `undefined` if the string cannot be parsed, and returns objects unchanged.

```js
const Srf = require('drachtio-srf');
const parseUri = Srf.parseUri;

srf.invite((req, res) => {
  // INVITE sip:5083084809@127.0.0.1:5060;tgrp=NYC-2 SIP/2.0
  console.log(JSON.stringify(parseUri(req.uri)));
  // {
  //   "family": "ipv4",
  //   "scheme": "sip",
  //   "user": "5083084809",
  //   "host": "127.0.0.1",
  //   "port": 5060,
  //   "params": {"tgrp": "NYC-2"},
  //   "headers": {}
  // }
  res.send(480);
});
```

### Srf.stringifyUri {#srf-stringifyuri}

A function that does the reverse of `parseUri`: it turns a parsed URI object back into a string.

### Srf.SipError {#srf-siperror}

The [SipError](./siperror.md#siperror) class. Use it with `instanceof` to tell SIP failure responses apart from other errors.

### Srf.Dialog {#srf-dialog}

The [Dialog](./dialog.md#dialog) class.

### Srf.SipMessage, Srf.SipRequest, Srf.SipResponse {#srf-sipmessage}

<span id="srf-siprequest"></span><span id="srf-sipresponse"></span>The [SipMessage](./sipmessage.md#sipmessage), [Request](./request.md#request) and [Response](./response.md#response) classes. `Srf.SipMessage` also has a static `parseUri`.

### Srf.DialogState {#srf-dialogstate}

Constants used in [dialog state events](#srf-dialog-state-events): `Trying` (`'trying'`), `Proceeding` (`'proceeding'`), `Early` (`'early'`), `Confirmed` (`'confirmed'`), `Terminated` (`'terminated'`), `Rejected` (`'rejected'`), `Cancelled` (`'cancelled'`).

### Srf.DialogDirection {#srf-dialogdirection}

Constants: `Initiator` (`'initiator'`) and `Recipient` (`'recipient'`).

## Events {#srf-events}

### 'connect' {#srf-event-connect}

```js
srf.on('connect', (err, hostport, serverVersion, localHostports) => {})
```

Emitted when a connection to a drachtio server has been authenticated, or has failed to authenticate. When the application [listens](#srf-listen) for outbound connections, it is emitted for each server that connects.

| Name | Type | Description |
|------|------|-------------|
| `err` | Error | Set if authentication failed (`'failed to authenticate to server'`); otherwise `null`. |
| `hostport` | string | Comma-separated list of the SIP endpoints the server listens on, each written as `transport/address:port`, for example `udp/10.0.0.1:5060,tcp/10.0.0.1:5060`. |
| `serverVersion` | string | Version of the drachtio server, if it reports one. |
| `localHostports` | string | Comma-separated list of the server's local (private) SIP endpoints, if it reports them. |

### 'listening' {#srf-event-listening}

```js
srf.on('listening', () => {})
```

Emitted when the server started by [`listen()`](#srf-listen) is ready to accept connections.

### 'reconnecting' {#srf-event-reconnecting}

```js
srf.on('reconnecting', (opts) => {})
```

Emitted before each automatic reconnect attempt on an inbound connection. `opts` is `{delay, attempt}`: the wait before this attempt, in milliseconds, and the attempt number.

### 'error' {#srf-event-error}

```js
srf.on('error', (err, socket) => {})
```

Emitted when an inbound connection to the drachtio server fails or is lost. After emitting it, the library tries to reconnect, following the [`reconnect` options](#srf-connect).

::: warning Warning
Always add an `error` listener when you use `connect()`. Under Node.js rules, an `error` event with no listener throws, which crashes the process.
:::

### 'close' {#srf-event-close}

```js
srf.on('close', (socket) => {})
```

Emitted when a connection to a drachtio server closes. Any requests still waiting for a response on that connection fail with an `ECONNLOST` error. <Badge type="info" text="next release" />

### 'cdr:attempt' {#srf-event-cdr-attempt}

```js
srf.on('cdr:attempt', (source, time, msg) => {})
```

Emitted when a call attempt is received (inbound) or started (outbound). Adding a listener for any `cdr:*` event asks the drachtio server to send call detail records to the application. See [Call Detail Records](../call-detail-records.md).

| Name | Type | Description |
|------|------|-------------|
| `source` | string | `'network'` for a received INVITE, `'application'` for a sent one. |
| `time` | string | The time (UTC) the SIP stack recorded for the attempt. |
| `msg` | [SipMessage](./sipmessage.md#sipmessage) | The INVITE that was received or sent. |

### 'cdr:start' {#srf-event-cdr-start}

```js
srf.on('cdr:start', (source, time, role, msg) => {})
```

Emitted when a call attempt is answered, that is, the call has started.

| Name | Type | Description |
|------|------|-------------|
| `source` | string | `'network'` or `'application'`, as for `cdr:attempt`. |
| `time` | string | The time (UTC) the SIP stack recorded. |
| `role` | string | `'uac'`, `'uas'`, `'uac-proxy'` or `'uas-proxy'`: whether the application is acting as a user agent client, a user agent server, or a proxy sending or receiving the message. |
| `msg` | [SipMessage](./sipmessage.md#sipmessage) | The message sent or received. |

### 'cdr:stop' {#srf-event-cdr-stop}

```js
srf.on('cdr:stop', (source, time, reason, msg) => {})
```

Emitted when a call ends. That is either a connected call hanging up, or an attempt that was rejected with a final failure response.

| Name | Type | Description |
|------|------|-------------|
| `source` | string | `'network'` or `'application'`. |
| `time` | string | The time (UTC) the SIP stack recorded. |
| `reason` | string | Why the call ended. |
| `msg` | [SipMessage](./sipmessage.md#sipmessage) | The message sent or received. |
