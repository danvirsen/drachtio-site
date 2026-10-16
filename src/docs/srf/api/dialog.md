# Dialog {#dialog}

A `Dialog` represents a SIP dialog (an INVITE or a SUBSCRIBE dialog) between the application and a remote endpoint. You never construct one yourself: they come from [`srf.createUAS()`](./srf.md#srf-createuas), [`srf.createUAC()`](./srf.md#srf-createuac) and [`srf.createB2BUA()`](./srf.md#srf-createb2bua). `Dialog` extends Node.js `EventEmitter`. Requests that arrive within the dialog are delivered as [events](#dialog-events) on it.

## Properties {#dialog-properties}

| Property | Type | Description |
|----------|------|-------------|
| <span id="dialog-id"></span>`id` | string | Unique dialog id assigned by the drachtio server (the `stackDialogId`). |
| <span id="dialog-type"></span>`type` | string | `'uac'` or `'uas'`. |
| <span id="dialog-dialogtype"></span>`dialogType` | string | `'INVITE'` or `'SUBSCRIBE'`: the method that created the dialog. |
| <span id="dialog-subscribeevent"></span>`subscribeEvent` | string | For a SUBSCRIBE dialog, the value of the `Event` header; otherwise `null`. |
| <span id="dialog-sip"></span>`sip` | Object | `{callId, localTag, remoteTag}`: the SIP Call-ID and the tags of the two sides. |
| <span id="dialog-local"></span>`local` | Object | `{uri, sdp, contact}`: the local side's URI, current SDP and Contact header. |
| <span id="dialog-remote"></span>`remote` | Object | `{uri, sdp}`: the remote side's Contact URI and current SDP. Unlike `local`, it has no `contact` field. |
| <span id="dialog-onhold"></span>`onHold` | boolean | `true` once the dialog has been put on hold (by [`modify('hold')`](#dialog-modify), or by the far end when you listen for [`hold`](#dialog-event-hold)). |
| <span id="dialog-connected"></span>`connected` | boolean | `true` until the dialog has been destroyed. |
| <span id="dialog-other"></span>`other` | Dialog | For dialogs created by `createB2BUA()`, the other leg. |
| <span id="dialog-req"></span>`req` | [Request](./request.md#request) | The request that created the dialog. |
| <span id="dialog-res"></span>`res` | [Response](./response.md#response) | The response that created the dialog. |
| <span id="dialog-srf"></span>`srf` | [Srf](./srf.md#srf) | The `Srf` instance that owns the dialog. |
| <span id="dialog-socket"></span>`socket` | `net.Socket` | The connection to the drachtio server that the dialog uses. |
| <span id="dialog-auth"></span>`auth` | Object or function | Credentials from `opts.auth` of `createUAC()`, reused for in-dialog requests. |
| <span id="dialog-subscriptions"></span>`subscriptions` | Array&lt;string&gt; | Active subscriptions in a SUBSCRIBE dialog. |
| <span id="dialog-queuerequests"></span>`queueRequests` | boolean (write-only) | While `true`, incoming in-dialog requests are held. Setting it to `false` processes the held requests. |

## Methods {#dialog-methods}

### destroy() {#dialog-destroy}

```js
dialog.destroy([opts], [callback])
```

Ends the dialog. For an INVITE dialog it sends a BYE. For a SUBSCRIBE dialog it sends a NOTIFY with `Subscription-State: terminated`. The dialog is then removed and all its event listeners are removed. Its own [`destroy`](#dialog-event-destroy) event is **not** emitted, because that event reports the far end hanging up.

| Name | Type | Description |
|------|------|-------------|
| `[opts]` | Object | Options. |
| `[opts.headers]` | Object | SIP headers to add to the BYE or NOTIFY. |
| `[opts.auth]` | Object or function | Credentials to use if the BYE is challenged. Default: `dialog.auth`. |
| `[callback]` | function | Called as `(err, msg)`, where `msg` is the BYE or NOTIFY that was sent. For a BYE, it is called once the response to the BYE arrives. |

**Returns:** a Promise that resolves to the BYE or NOTIFY that was sent if no callback is given; otherwise the Dialog.

```js
await dialog.destroy({headers: {'Reason': 'Q.850;cause=16;text="Normal call clearing"'}});
```

### modify() {#dialog-modify}

```js
dialog.modify([sdp], [opts], [callback])
```

Changes the session by sending a re-INVITE. Only one re-INVITE is in progress at a time: if you call `modify()` again before the first one finishes, the second call waits its turn.

| Name | Type | Description |
|------|------|-------------|
| `[sdp]` | string | `'hold'` changes `a=sendrecv` to `a=inactive` in the local SDP and sets `onHold`. `'unhold'` changes `a=inactive` back to `a=sendrecv`, and fails if the dialog is not on hold. Any other string is used as the new local SDP. If you leave it out, the re-INVITE has no SDP (3pcc). |
| `[opts]` | Object | Options. |
| `[opts.headers]` | Object | SIP headers to add to the re-INVITE. If you do not include a Contact header, the dialog's local Contact is added. |
| `[opts.auth]` | Object or function | Credentials to use if the re-INVITE is challenged. Default: `dialog.auth`. |
| `[opts.noAck]` | boolean | Used when there is no `sdp`. If `true`, the 200 OK is not ACKed automatically. The result is then `{sdp, ack}`, where `sdp` is the remote offer from the 200 OK and `ack(localSdp)` sends the ACK with your answer. With a callback, the callback receives `(err, sdp, ack)` instead. |
| `[callback]` | function | Called as `(err, remoteSdp)`. |

**Returns:** a Promise that resolves to the remote SDP from the 200 OK (or to `{sdp, ack}` when `noAck` applies) if no callback is given; otherwise the Dialog. `dialog.remote.sdp` is updated. A final response other than 200 fails with a [`SipError`](./siperror.md#siperror). Calling `modify()` on a dialog that has already been destroyed fails with an `Error`.

::: warning
`modify('unhold')` restores the SDP but leaves `dialog.onHold` set to `true`.
:::

```js
// put the far end on hold, then take it off hold
await dialog.modify('hold');
await dialog.modify('unhold');

// offer new SDP
const remoteSdp = await dialog.modify(newSdp);
```

### request() {#dialog-request}

```js
dialog.request(opts, [callback])
```

Sends a request within the dialog (for example INFO, NOTIFY, REFER, MESSAGE or OPTIONS).

| Name | Type | Description |
|------|------|-------------|
| `opts` | Object | Options. |
| `opts.method` | string | SIP method, in **upper case** (for example `'INFO'`). It must be a known SIP method, otherwise it throws an error. |
| `[opts.headers]` | Object | SIP headers to add to the request. |
| `[opts.body]` | string | Message body. |
| `[opts.auth]` | Object or function | Credentials to use if the request is challenged. Default: `dialog.auth`. |
| `[opts.noAck]` | boolean | For an INVITE with no body: if `true`, the 200 OK is not ACKed. Instead the callback receives `(err, res, ack)`. This only works with a callback; the Promise form does not give you `ack`. |
| `[callback]` | function | Called as `(err, res)`, where `res` is the [Response](./response.md#response) received. |

**Returns:** a Promise that resolves to the [Response](./response.md#response) received if no callback is given; otherwise the Dialog.

Sending a BYE with `request()` removes the dialog from `srf`'s set of tracked dialogs. Sending a NOTIFY with `Subscription-State: terminated` in a SUBSCRIBE dialog ends that subscription; when it was the last one, the dialog emits `destroy`.

```js
const res = await dialog.request({
  method: 'INFO',
  headers: {'Content-Type': 'application/dtmf-relay'},
  body: 'Signal=5\r\nDuration=160'
});
console.log(`INFO got ${res.status}`);
```

### &lt;method&gt;() shortcuts {#dialog-method-shortcuts}

```js
dialog.<method>(opts, [callback])
```

`Dialog` has one shortcut per SIP method (`dialog.info()`, `dialog.notify()`, `dialog.refer()`, and so on), meant as shorthand for `request()` with `opts.method` filled in.

::: warning Known problem
These shortcuts don't work: calling one throws `TypeError: this.request is not a function`. Use [`dialog.request({method: 'INFO', ...})`](#dialog-request) instead.
:::

### toJSON() {#dialog-tojson}

```js
dialog.toJSON()
```

Returns `{id, type, sip, local, remote, onHold}`.

## Events {#dialog-events}

Requests that arrive within a dialog are sent to its `Dialog` object as events. For most of them, if you add a listener, **you must send the response yourself** with `res.send()`. If there is no listener, the library sends a default response.

### 'ack' {#dialog-event-ack}

```js
dialog.on('ack', (req) => {})
```

Emitted for a UAS dialog when the ACK for the 200 OK arrives. If the ACK carries SDP (a late-offer/3pcc call), `dialog.remote.sdp` has already been updated by the time this event fires.

### 'destroy' {#dialog-event-destroy}

```js
dialog.on('destroy', (req, [reason]) => {})
```

Emitted when the far end ends the dialog. In an INVITE dialog that means a BYE, which the library answers with 200 OK. In a SUBSCRIBE dialog it means a NOTIFY with `Subscription-State: terminated` for the last subscription. After the event, all listeners are removed.

| Name | Type | Description |
|------|------|-------------|
| `req` | [Request](./request.md#request) | The BYE (or NOTIFY) that ended the dialog. |
| `reason` | string | BYE only. `'normal release'`, unless the BYE was generated by the drachtio server itself (for example after an ACK timeout). In that case it is the text from the BYE's `Reason` header. |

### 'modify' {#dialog-event-modify}

```js
dialog.on('modify', (req, res) => {})
```

Emitted when the far end sends a re-INVITE that is not recognized as a hold, unhold or refresh (see the events below). The handler must answer it with `res.send()`. If there is no listener, the library answers with 200 OK and the current local SDP. Before the event, `dialog.remote.sdp` is updated to the new offer.

### 'hold' {#dialog-event-hold}

```js
dialog.on('hold', (req) => {})
```

Emitted when the far end puts the call on hold. It is only emitted if you have attached a `hold` listener, and only when the new offer is the same as the previous remote SDP except that `a=sendrecv` has become `a=sendonly` (the `o=` line is ignored). The library then changes `a=sendrecv` to `a=recvonly` in the local SDP, sets `onHold = true`, and answers with 200 OK itself, so your handler must not respond.

### 'unhold' {#dialog-event-unhold}

```js
dialog.on('unhold', (req) => {})
```

Emitted when the far end takes a held call off hold. It is only emitted if you have attached an `unhold` listener and the dialog is on hold, and only when the new offer is the previous remote SDP with `a=sendonly` changed back to `a=sendrecv`. The library changes `a=recvonly` back to `a=sendrecv` in the local SDP, clears `onHold`, and answers with 200 OK itself.

### 'refresh' {#dialog-event-refresh}

```js
dialog.on('refresh', (req) => {})
```

Emitted when the far end sends a session-refresh re-INVITE. It is only emitted if you have attached a `refresh` listener. A re-INVITE counts as a refresh when its SDP has the same origin session id and version as the current remote SDP. The library answers with 200 OK itself; this event is only a notification.

### 'info' {#dialog-event-info}

```js
dialog.on('info', (req, res) => {})
```

Emitted when an INFO request arrives. The handler must call `res.send()`. If there is no listener, the library answers with 200 OK.

### 'message' {#dialog-event-message}

```js
dialog.on('message', (req, res) => {})
```

Emitted when a MESSAGE request arrives. The handler must call `res.send()`. If there is no listener, the library answers with 200 OK.

### 'notify' {#dialog-event-notify}

```js
dialog.on('notify', (req, res) => {})
```

Emitted when a NOTIFY request arrives. The handler must call `res.send()`. If there is no listener, the library answers with 200 OK. In a SUBSCRIBE dialog, a NOTIFY with `Subscription-State: terminated` also ends that subscription, and `destroy` is emitted when it was the last one.

### 'options' {#dialog-event-options}

```js
dialog.on('options', (req, res) => {})
```

Emitted when an OPTIONS request arrives. The handler must call `res.send()`. If there is no listener, the library answers with 200 OK.

### 'publish' {#dialog-event-publish}

```js
dialog.on('publish', (req, res) => {})
```

Emitted when a PUBLISH request arrives. The handler must call `res.send()`. If there is no listener, the library answers with 200 OK.

### 'refer' {#dialog-event-refer}

```js
dialog.on('refer', (req, res) => {})
```

Emitted when a REFER request arrives. The handler must call `res.send()`. If there is no listener, the library answers with 200 OK.

### 'update' {#dialog-event-update}

```js
dialog.on('update', (req, res) => {})
```

Emitted when an UPDATE request arrives. The handler must call `res.send()`. If there is no listener, the library answers with 200 OK, which includes the current local SDP when the UPDATE carried a body.

### 'subscribe' {#dialog-event-subscribe}

```js
dialog.on('subscribe', (req, res) => {})
```

Emitted when a SUBSCRIBE arrives within a SUBSCRIBE dialog (a subscription refresh) with a non-zero `Expires`. The handler must call `res.send()`. If there is no listener, the library answers with `489 Bad Event`.

### 'unsubscribe' {#dialog-event-unsubscribe}

```js
dialog.on('unsubscribe', (req, reason) => {})
```

Emitted when a SUBSCRIBE with `Expires: 0` arrives within the dialog. The library has already answered it with 202, and `reason` is `'unsubscribe'`.

Any other method that arrives within a dialog is answered with `501 Not Implemented`.
