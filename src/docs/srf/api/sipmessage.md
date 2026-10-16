# SipMessage {#sipmessage}

<span id="sip-message"></span>The methods and properties shared by [Request](./request.md#request) and [Response](./response.md#response). The `msg` argument of the `cdr:*` events is a plain `SipMessage`. In the signatures below, `msg` stands for a request or a response.

## Methods {#sipmessage-methods}

### get() {#sipmessage-get}

```js
msg.get(name)
```

Returns the value of a header as a string, or `undefined` if the header is not present. Header names are not case-sensitive, and SIP compact forms (for example `f` for From) are recognized. If a header appears more than once, the values are joined with commas.

```js
srf.invite((req, res) => {
  console.log(req.get('Via'));
  // SIP/2.0/UDP 172.16.0.129:5061;branch=z9hG4bK-1859-1-0;received=127.0.0.1;rport=5061
});
```

### getParsedHeader() {#sipmessage-getparsedheader}

```js
msg.getParsedHeader(name)
```

Returns a header parsed into an object. Parsers exist for To, From, Contact, Via, CSeq, Route, Record-Route, Path, Refer-To, Referred-By, P-Asserted-Identity, Remote-Party-ID, WWW-Authenticate, Proxy-Authenticate, Authorization, Proxy-Authorization, Authentication-Info and Content-Length. Other headers are returned unparsed.

::: warning Warning
`getParsedHeader()` **throws** if the header is not present. Check with [`has()`](#sipmessage-has) first.
:::

```js
srf.invite((req, res) => {
  console.log(JSON.stringify(req.getParsedHeader('Via')));
  /*
  [{
    "version": "2.0",
    "protocol": "UDP",
    "host": "172.16.0.129",
    "port": 5061,
    "params": {
      "branch": "z9hG4bK-2070-1-0",
      "received": "127.0.0.1",
      "rport": "5061"
    }
  }]
  */
});
```

### has() {#sipmessage-has}

```js
msg.has(name)
```

Returns `true` if the header is present.

### set() {#sipmessage-set}

```js
msg.set(name, value)
```

Sets a header. You can also pass one object of `{name: value}` pairs. If the header already exists, the new value is appended after a comma. Returns the message.

### getHeaderName() {#sipmessage-getheadername}

```js
msg.getHeaderName(name)
```

Returns the header name exactly as it is stored in the message (matched without regard to case), or `undefined`.

## Properties {#sipmessage-properties}

| Property | Description |
|----------|-------------|
| <span id="sipmessage-type"></span>`type` | `'request'` or `'response'`. |
| <span id="sipmessage-headers"></span>`headers` | Object holding all SIP headers. Header names are stored in lower case, except names starting with `X-` or `P-` (other than P-Asserted-Identity), `Diversion`, and any names listed in the `DRACHTIO_PRESERVE_HEADER_NAMES` environment variable (comma-separated). |
| <span id="sipmessage-body"></span>`body` | Message body as a string. |
| <span id="sipmessage-payload"></span>`payload` | The body split into parts: an array of `{type, content}`. For a `multipart/*` body there is one entry per part; otherwise there is a single entry. |
| <span id="sipmessage-raw"></span>`raw` | The raw message text, for messages received from or echoed by the server. |
| <span id="sipmessage-method"></span>`method` | SIP method (requests only). |
| <span id="sipmessage-uri"></span>`uri` | Request URI (requests only). |
| <span id="sipmessage-status"></span>`status` | Status code (responses only). |
| <span id="sipmessage-reason"></span>`reason` | Reason phrase (responses only). |
| <span id="sipmessage-callingnumber"></span>`callingNumber` | User part of the P-Asserted-Identity header if present, otherwise of the From header (requests only). |
| <span id="sipmessage-callingname"></span>`callingName` | Quoted display name from P-Asserted-Identity if present, otherwise from From; an empty string if there is none (requests only). |
| <span id="sipmessage-callednumber"></span>`calledNumber` | User part of the request URI (requests only). |
| <span id="sipmessage-canformdialog"></span>`canFormDialog` | `true` for an INVITE or SUBSCRIBE (requests only). |

```js title="Using req.payload with multipart content"
// e.g., a SIPREC INVITE has multipart content
srf.invite((req, res) => {
  if (req.payload.length > 1) {
    console.log(`we have multipart content: ${JSON.stringify(req.payload)}`);
  }
  /*
  [{
    "type": "application/sdp",
    "content": "v=0\r\no=Sonus_UAC 328001 655768 .."
  }, {
    "type": "application/rs-metadata+xml",
    "content": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<tns:recording ..."
  }]
  */
});
```
