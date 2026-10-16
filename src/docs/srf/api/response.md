# Response {#response}

<span id="sip-response"></span>A SIP response, either one the application sends (the `res` passed to request handlers) or one it receives (in the [`response`](./request.md#request-event-response) event). It provides all the [SipMessage](./sipmessage.md#sipmessage) methods and properties, and extends `EventEmitter`. The class is available as `Srf.SipResponse`.

## Methods {#response-methods}

### send() {#response-send}

```js
res.send(status, [reason], [opts], [callback], [fnAck])
```

Sends a response to an incoming request. You can call it with any of the optional arguments left out, for example `send(status)`, `send(status, opts)`, `send(status, callback)` or `send(status, reason, opts, callback)`.

| Name | Type | Description |
|------|------|-------------|
| `status` | number | SIP status code. Throws if it is not a known SIP status code. |
| `[reason]` | string | Reason phrase. Default: the standard phrase for `status`. |
| `[opts]` | Object | Options. |
| `[opts.headers]` | Object | SIP headers to add. If you include a `To` header with `tag=...`, that tag is used as the local tag, as long as the To header does not already have one. |
| `[opts.body]` | string | Message body. |
| `[callback]` | function | Called as `(err, msg)`, where `msg` is the response as it was sent. |
| `[fnAck]` | function | Called with the incoming PRACK (for a reliable provisional response) or ACK (for a 200 OK) when it arrives. |

**Returns:** `undefined`. If a final response has already been sent, nothing is sent and the callback (if any) gets an error.

```js
srf.register((req, res) => {
  res.send(200, {
    headers: {
      'Contact': req.get('Contact'),
      'Expires': '3600'
    }
  });
});

srf.invite((req, res) => res.send(486, 'Busy Here'));
```

## Properties {#response-properties}

| Property | Description |
|----------|-------------|
| <span id="response-status"></span>`status` | SIP status code. |
| <span id="response-statuscode"></span>`statusCode` | Alias for `status`. |
| <span id="response-reason"></span>`reason` | Reason phrase. |
| <span id="response-finalresponsesent"></span>`finalResponseSent` | `true` once a final (status 200 or higher) response has been sent. `headersSent` is an alias. |
| <span id="response-req"></span>`req` | The [Request](./request.md#request) this response belongs to. |
| <span id="response-socket"></span>`socket` | The drachtio server connection. |
| <span id="response-source"></span>`source`, `source_address`, `source_port`, `protocol`, `stackTime`, `stackTxnId`, `stackDialogId`, `meta` | For received responses, as for [Request](./request.md#request-properties). |

## Events {#response-events}

### 'end' {#response-event-end}

```js
res.on('end', ({status, reason}) => {})
```

Emitted when the application sends a final response.

### 'finish' {#response-event-finish}

```js
res.on('finish', () => {})
```

Emitted shortly after a final response has been handed to the drachtio server.
