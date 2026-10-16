# SIP Messages

In the examples above, we've seen the callback signature `(req, res)` through which we are passed objects representing a SIP request and an associated response.  These objects are event emitters and have some useful properties and methods attached.  Since we will be interacting with these objects a lot when writing applications, let's review them now.

## Properties, methods and events

The following properties are available on both `req` and `res` objects:

* `type`: 'request' or 'response'
* `headers`: an object containing the SIP headers of the message
* `body`: the SIP message body, if any
* `payload`: an array of content, useful mainly if the message included multipart content.  Each object in the payload array has a `type` and `content` property, containing the Content-Type header and the associated content, respectively 
* `source`: 'network' or 'application'; the sender of the message
* `source_address`: the IP address of the sender
* `source_port`: the source port of the sender
* `protocol`: the transport protocol being used (e.g., 'udp', 'tcp')
* `stackTime`: the time the message was sent or received by the drachtio server sip stack
* `stackTxnId`: the transaction identifier assigned by the drachtio server
* `stackDialogId`: the dialog identifier (if a dialog has been established)
* `raw`: a string containing the full, unparsed SIP message
* `msg`: the parsed SIP message (a `SipMessage` object) holding the headers and body
* `srf`: a reference to the [Srf](./api/srf.md#srf) instance; useful for making outbound SIP requests from within a request handler (set on incoming requests and their responses)

The  following methods are available on both `req` and `res` objects as well:

* `has(name)`: returns true if the message includes the specified header
* `get(name)`: returns the value of a specified SIP header, as a string
* `set(name, value)`: sets the value of a specified SIP header (if the header already exists, the new value is appended to it, separated by a comma).  An object of header names and values may be passed instead to set multiple headers at once.
* `getHeaderName(name)`: returns the header name exactly as it appears in the message (header lookups are case-insensitive)
* `getParsedHeader(name)`: returns an object that represents the specified SIP header parsed into components.  An exception is thrown if the header is not present in the message, so check with `has(name)` first if the header is optional.

Header names are matched case-insensitively, and compact header forms (e.g. 'f' for 'From', 'i' for 'Call-ID') are understood.

`getParsedHeader` understands the following headers; any other header is returned as a plain string (see [getParsedHeader](./api/sipmessage.md#sipmessage-getparsedheader) for full details):

* `To`, `From`, `Refer-To`, `Referred-By`, `P-Asserted-Identity`, `Remote-Party-ID`: an object with `name` (display name, if any), `uri` and `params` properties
* `Contact`: an array of objects with `name`, `uri` and `params` properties (or the string '*')
* `Via`: an array of objects with `version`, `protocol`, `host`, `port` and `params` properties
* `Route`, `Record-Route`, `Path`: an array of objects with `name`, `uri` and `params` properties, where `uri` is itself a parsed uri (see below)
* `CSeq`: an object with `seq` and `method` properties
* `Content-Length`: a number
* `Authorization`, `Proxy-Authorization`, `WWW-Authenticate`, `Proxy-Authenticate`: an array of objects containing the scheme and parameters of the header; `Authentication-Info`: an object with the header parameters

```js
srf.invite((req, res) => {
  const from = req.getParsedHeader('From');
  console.log(`call from ${from.name} at ${from.uri}, tag ${from.params.tag}`);
});
```

#### Parsing SIP URIs

The Srf class exposes `parseUri` and `stringifyUri` static helpers for working with SIP (and tel) URIs:

```js
const Srf = require('drachtio-srf');
const {parseUri} = Srf;

srf.invite((req, res) => {
  const uri = parseUri(req.uri);
  // {
  //   family: 'ipv4',
  //   scheme: 'sip',
  //   user: '+15083084807',
  //   host: '192.168.1.100',
  //   port: 5080,
  //   params: {transport: 'udp'},
  //   headers: {}
  // }
});
```

::: info Note
When you set headers on an outgoing message, most header names are sent in lower case.  Headers starting with `X-` or `P-`, and `Diversion`, keep the case you used.  To keep the case of other headers, set the environment variable `DRACHTIO_PRESERVE_HEADER_NAMES` to a comma-separated list of those names, spelled exactly as in your code (e.g. `DRACHTIO_PRESERVE_HEADER_NAMES=Geolocation,Resource-Priority`).  See also the server's [preserve-header-names](../server/configuring.md#preserve-header-names) setting.
:::

### Request-specific properties, methods and events

The `req` object additionally has the following properties:

* `method`: the SIP method of the request
* `uri`: the SIP Request-URI (alias: `url`)
* `calledNumber`: the phone number (if any) parsed from the user part of the request uri
* `callingNumber`: the phone number (if any) of the calling party, parsed from the P-Asserted-Identity header if it exists, otherwise from the From header.
* `callingName`: the display name (if any) of the calling party, taken from the P-Asserted-Identity header if it exists, otherwise from the From header.
* `isNewInvite`: true if the request is a new INVITE (vs a re-INVITE, or a non-INVITE request).  Note this is a property, not a method.
* `canFormDialog`: true if the request is an INVITE or SUBSCRIBE that could create a new dialog
* `res`: a reference to the associated [Response](./api/response.md#response) object
* `socket`: the socket connection to the drachtio server over which the request was received or sent
* `server`: for incoming requests, an object with `address` and `hostport` properties describing the drachtio server that delivered the request
* `receivedOn`: for incoming requests, the local SIP address and port on the drachtio server where the request was received

the following methods:

* `cancel([opts], [callback])`: cancels an INVITE request that was sent by the application.  `opts.headers` may be used to add SIP headers to the CANCEL request.
* `proxy(opts, [callback])`: proxies an incoming request.  While this method is available, the preferred usage is to call [srf.proxyRequest()](sip-proxy.md) instead.

and emits the following events:

* `cancel`: this event is emitted for an incoming INVITE request, when a CANCEL for that INVITE is subsequently received from the sender.
* `response`: when an application sends a SIP request, an application can listen for the 'response' event to obtain the matching SIP response that is received.  The listener is invoked with `(res, ack)`; for a final response to an INVITE, `ack` is a function the application calls to send the ACK (for a reliable provisional response, it sends the PRACK).
* `update`: emitted when an UPDATE request is received for an INVITE transaction that is still in progress; the listener is invoked with `(req, res)` for the UPDATE.  If an incoming INVITE has no listener for this event, the UPDATE is rejected with a 500 response and a Retry-After header.
* `authenticate`: emitted when a request sent by the application was challenged and has been automatically re-sent with credentials (see the `auth` option); the listener receives the new request.

### Response-specific properties, methods and events

The `res` object additionally has the following properties:

* `status`: the SIP response status, as an integer (alias: `statusCode`)
* `reason`: the SIP reason (e.g. 'Busy Here')
* `finalResponseSent`: true if a final response has been sent (alias: `headersSent`)
* `finished`: true if the final response has been sent
* `req`: a reference to the associated [Request](./api/request.md#request) object

and the following methods:

* `send(status, [reason], [opts], [callback])`: we have already seen this method used to send a response.  Only the status parameter is required. 
    * `status`: the SIP response status code (required)
    * `reason`: the SIP reason phrase (optional, e.g., 'Busy Here'); if not provided the standard reason phrase for the status is used
    * `opts`: an optional object that can include:
        * `headers`: an object containing SIP headers to include in the response
        * `body`: the message body (e.g., SDP for 200 OK responses)
    * `callback`: optional callback invoked with `(err, msg)` where `msg` is the SIP response that was actually sent

Calling `send` again after a final response has already been sent has no effect (if a callback was supplied, it is invoked with an error).

and emits the following events:

* `end`: emitted when a final response is sent, with an object containing the `status` and `reason`
* `finish`: emitted after a final response has been sent

## Usage patterns

In the few sample code snippets we've looked at so far, we have been receiving SIP requests and then sending SIP responses in return.  

However, we can also do the reverse -- send out a SIP request and receive a response back.  In either case, we are dealing with the request and response objects described above, but different methods and events may apply.  Below some of the common patterns are covered.

#### Receiving a request and sending a response
```js
srf.options((req, res) => {
  res.send(200);
});
```
#### Sending a response with headers
```js
srf.options((req, res) => {
  res.send(200, {
    headers: {
      'Subject': 'All\'s well here'
    }
  });
});
```
#### Sending a response with callback to get the msg actually sent
```js
srf.options((req, res) => {
  res.send(200, {
    headers: {
      'Subject': 'All\'s well here'
    }
  }, (err, msg) => {
    const to = msg.getParsedHeader('To');
    console.log(`drachtio server added tag on To header: ${to.params.tag}`);
  });
});
```
#### Sending a request, and then receiving the response
```js
srf.request('sip:1234@example.com', {
  method: 'OPTIONS'
}, (err, req) => {
  // req is the SIP request that went out over the wire
  req.on('response', (res) => {
    console.log(`received ${res.status} response to our OPTIONS request`);
  });
});
```
#### Sending a request with headers and body
```js
const dtmf = 
`Signal=5
Duration=160`;

srf.request('sip:1234@example.com', {
  method: 'INFO', 
  headers: {
    'Content-Type': 'application/dtmf-relay'
  },
  body: dtmf
});
```
#### Handling the cancel of an INVITE
```js
srf.invite((req, res) => {
  let canceled = false;

  req.on('cancel', () => canceled = true);

  doLengthyDatabaseLookup()
    .then((results) => {
      
      // was the call canceled while 
      // we were doing database lookup?

      if (canceled) return;

      // ..go on to process the call
    });
});
```

## Common Options Explained

### The `proxy` option

The `proxy` option can be provided to route outgoing SIP requests through an outbound proxy instead of directly to the destination. It is available in:

- **`srf.createUAC()`**: Routes the UAC INVITE through a proxy
- **`srf.createB2BUA()`**: Routes the B-leg INVITE through a proxy
- **`srf.request()`**: Routes any request through a proxy

```js
// Example: send INVITE through a proxy
srf.createUAC('sip:1234@10.10.100.1', {
  localSdp: mySdp,
  proxy: 'sip:proxy.example.com'
});
```

The proxy can be specified as:

- A SIP URI: `'sip:proxy.example.com'`
- An IP address: `'10.10.10.1'`
- An IP address with port: `'10.10.10.1:5060'`

### The `localSdpA` and `localSdpB` options

These options are used in **`srf.createB2BUA()`** to control the SDP (Session Description Protocol) on each leg of a call:

- **`localSdpA`**: The SDP to send in the 200 OK response to the A-leg (caller). Can be a string SDP, or a function (which may be `async` or return a Promise) that is invoked with the SDP and the response received from the B-leg and returns the SDP to use.
- **`localSdpB`**: The SDP to offer in the INVITE to the B-leg (callee).  If not provided, the SDP from the A-leg INVITE is used.

```js
// Simple passthrough: A's SDP is offered to B, and B's SDP is the answer to A
srf.createB2BUA(req, res, 'sip:1234@10.10.100.1', {
  localSdpB: req.body  // use A's SDP as the offer to B (this is also the default)
});

// Advanced: modify SDP on each leg using functions
srf.createB2BUA(req, res, 'sip:1234@10.10.100.1', {
  localSdpB: req.body,
  localSdpA: (sdpB, res) => {
    // sdpB is the SDP from B leg
    // res is the response from B leg
    return modifySdpForA(sdpB); // return modified SDP for A leg
  }
});
```

If `localSdpA` is not provided, the SDP from the B-leg's response is automatically passed through to the A-leg.

### The `noAck` option (3pcc)

The `noAck` option is used with `srf.createUAC()` for **third-party call control (3pcc)** scenarios, where an INVITE is sent *without* an SDP offer (i.e. no `localSdp` is provided).  In that case the remote party makes its offer in the 200 OK, and our answer must be sent in the ACK.  `noAck` lets your application obtain the remote offer first and supply the answer later, once it is known.

```js
const {sdp, ack} = await srf.createUAC('sip:1234@10.10.100.1', {
  noAck: true          // note: no localSdp, so the INVITE is sent without SDP
});

// sdp is the offer from the remote party, received in the 200 OK
const localSdp = await getAnswerFromMediaServer(sdp);

// send the ACK with our answer; this resolves with the Dialog
const dialog = await ack(localSdp);
```

When `noAck: true` is set and the INVITE is sent without SDP:

- The 200 OK is not acknowledged automatically
- Instead of a Dialog, the Promise resolves (or callback is invoked) with an object containing `sdp` (the remote offer), `res` (the 200 OK response), an `ack(localSdp)` function and a `destroy()` function
- Your application must call `ack(localSdp)`, which sends the ACK with the provided SDP and returns a Promise that resolves with the Dialog
- If the application decides to abandon the call instead, it should call `destroy()`, which acknowledges the 200 OK and then sends a BYE

If `noAck` is set but a `localSdp` is provided, the option has no effect and a Dialog is returned as usual.  If an INVITE is sent without SDP and `noAck` is *not* set, drachtio-srf completes the call automatically by sending an ACK containing the remote party's SDP with the media direction set to `recvonly`.

### The `proxyRequestHeaders` and `proxyResponseHeaders` options

These options are used in **`srf.createB2BUA()`** to control which SIP headers are passed from the A-leg to the B-leg (and vice versa).  By default, no headers are copied.

- **`proxyRequestHeaders`**: Headers to copy from the incoming A-leg INVITE to the outgoing B-leg INVITE
- **`proxyResponseHeaders`**: Headers to copy from the B-leg response to the A-leg response

```js
// Copy specific headers
srf.createB2BUA(req, res, 'sip:1234@10.10.100.1', {
  localSdpB: req.body,
  proxyRequestHeaders: ['X-Custom-Header', 'Authorization'],
  proxyResponseHeaders: ['X-Custom-Response']
});
```

#### Using "all" to copy all headers

You can use `'all'` as the first element of either option to copy all headers (except headers like Via, From, To, Call-ID, CSeq, Contact, Content-Length, and Content-Type that are generated for each leg):

```js
// Copy all headers from A to B
proxyRequestHeaders: ['all']

// Copy all headers except X-Internal-Header
proxyRequestHeaders: ['all', '-X-Internal-Header']
```

The `-` prefix excludes specific headers from being copied when using `'all'`.

To add specific headers rather than copy them, use the `headers` option (headers to include on the B-leg INVITE) and the `responseHeaders` option (headers to include on responses sent to the A-leg).  `responseHeaders` can also be a function that is invoked with the B-leg response and the headers collected so far, and returns an object with additional headers to apply.
