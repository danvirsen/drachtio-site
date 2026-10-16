# Request {#request}

<span id="sip-request"></span>A SIP request that the application has either received or sent. It provides all the [SipMessage](./sipmessage.md#sipmessage) methods and properties, and extends `EventEmitter`. The class is available as `Srf.SipRequest`.

## Properties {#request-properties}

| Property | Description |
|----------|-------------|
| <span id="request-isnewinvite"></span>`isNewInvite` | `true` for an INVITE whose To header has no tag, meaning it is not part of an existing dialog. |
| <span id="request-source"></span>`source` | `'network'` (received) or `'application'` (sent by this application). |
| <span id="request-source-address"></span>`source_address` | IP address the message came from (for a sent request, the address it was sent to). |
| <span id="request-source-port"></span>`source_port` | Port, as a number. |
| <span id="request-protocol"></span>`protocol` | Transport protocol, for example `'udp'` or `'tcp'`. |
| <span id="request-stacktime"></span>`stackTime` | Time the SIP stack handled the message. |
| <span id="request-stacktxnid"></span>`stackTxnId` | Transaction id assigned by the SIP stack. |
| <span id="request-stackdialogid"></span>`stackDialogId` | Dialog id assigned by the SIP stack (for dialog-creating requests). |
| <span id="request-server"></span>`server` | For incoming requests: `{address, hostport}` of the drachtio server the request arrived through. |
| <span id="request-receivedon"></span>`receivedOn` | For incoming requests, if the server provides it: the local `address:port` the request was received on. |
| <span id="request-sessiontoken"></span>`sessionToken` | Optional session token from the drachtio server, if it provides one. |
| <span id="request-url"></span>`url` | Alias for `uri`. |
| <span id="request-meta"></span>`meta` | `{source, source_address, source_port, protocol, time, transactionId, dialogId}`. |
| <span id="request-srf"></span>`srf` | The [Srf](./srf.md#srf) instance, set on requests that arrive outside a dialog. |
| <span id="request-res"></span>`res` | For an incoming request, its [Response](./response.md#response). |
| <span id="request-socket"></span>`socket` | The drachtio server connection the message arrived (or was sent) on. |
| <span id="request-canceled"></span>`canceled` | Set to `true` by [`createUAS()`](./srf.md#srf-createuas) if the request was canceled. |

## Methods {#request-methods}

### cancel() {#request-cancel}

```js
req.cancel([opts], [callback])
```

Cancels a request that this application sent (typically an INVITE). It throws if called on a request the application received.

| Name | Type | Description |
|------|------|-------------|
| `[opts]` | Object | Options. |
| `[opts.headers]` | Object | SIP headers to add to the CANCEL. |
| `[callback]` | function | Called as `(err, cancel)`, where `cancel` is the CANCEL request that was sent. |

**Returns:** `undefined`.

### proxy() {#request-proxy}

```js
req.proxy(opts, [callback])
```

Proxies a request that the application received. It throws if called on a request the application sent. [`srf.proxyRequest()`](./srf.md#srf-proxyrequest) is usually more convenient.

| Name | Type | Description |
|------|------|-------------|
| `opts` | Object | Proxy options, as for [`srf.proxyRequest()`](./srf.md#srf-proxyrequest), plus `opts.destination` (string or Array; default: the request URI). |
| `[callback]` | function | Called as `(err, results)`. |

**Returns:** a Promise that resolves to the proxy results if no callback is given; otherwise the Request.

## Events {#request-events}

### 'response' {#request-event-response}

```js
req.on('response', (res, ack) => {})
```

Emitted on a request sent by the application each time a response arrives (provisional or final).

| Name | Type | Description |
|------|------|-------------|
| `res` | [Response](./response.md#response) | The response that arrived. |
| `ack` | function | For a final response to an INVITE, call `ack([opts])` to send the ACK. For a reliable provisional response (one with an RSeq header), it sends the PRACK instead. `opts` can contain `body` and `headers`. Otherwise it does nothing. |

### 'cancel' {#request-event-cancel}

```js
req.on('cancel', (cancelMsg) => {})
```

Emitted on an incoming INVITE when the caller cancels it. The argument is the CANCEL message. The drachtio server has already answered the CANCEL; the application should send a final response (normally 487) to the INVITE.

### 'update' {#request-event-update}

```js
req.on('update', (req, res) => {})
```

Emitted on a pending INVITE, either sent or received, when an UPDATE arrives in the same call before the INVITE transaction finishes. [`createUAC()`](./srf.md#srf-createuac) and [`createB2BUA()`](./srf.md#srf-createb2bua) handle this event themselves. If an incoming INVITE has no `update` listener, the UPDATE gets `500` with `Retry-After: 5`.

### 'authenticate' {#request-event-authenticate}

```js
req.on('authenticate', (newReq) => {})
```

Emitted on a request sent by the application when it was challenged and the library has sent it again with credentials. `newReq` is the new request, and existing `response` listeners have been moved to it.

### 'connection-lost' <Badge type="info" text="next release" /> {#request-event-connection-lost}

```js
req.on('connection-lost', (err) => {})
```

Emitted on a request sent by the application if the drachtio server connection closes before a final response arrives. `err.code` is `'ECONNLOST'`.

## Request failure codes {#request-error-codes}

When drachtio server refuses to send a request (`srf.request()`, `dialog.request()`, `createUAC()` and so on), the error passed to the callback (or the Promise rejection) has a `code`:

| `err.code` | Meaning |
|------------|---------|
| `ENODIALOG` | The server no longer has the dialog ("unable to find dialog"). This is often a harmless race: an in-dialog request was sent just as the dialog ended. |
| `EDRACHTIO` | Any other failure reported by the server. `err.message` has the reason. |
| `EINVALIDSOCKET` | The socket given was not a `net.Socket` or `tls.TLSSocket`. |
| `ESOCKETDESTROYED` | The socket given has been destroyed. |
| `ECONNLOST` <Badge type="info" text="next release" /> | The connection was lost while the request was waiting for a response (see the `connection-lost` event above). |
