# SIP Proxy

Building a SIP proxy with drachtio is pretty darn simple.
```js
srf.invite((req, res) => {
  srf.proxyRequest(req, 'sip.example1.com')
    .then((results) => console.log(JSON.stringify(results)) );
});
```
In the example above, we receive an INVITE and then proxy it onwards to the server at 'sip.example1.com'.

::: info Note
As with other methods, you can pass a callback as the final argument instead; it is invoked with `(err, results)` and no Promise is returned.
:::

[Srf#proxyRequest](./api/srf.md#srf-proxyrequest) returns a Promise that resolves when the proxy transaction is complete -- i.e. final responses and ACKs have been transmitted, and the call is either connected or has resulted in a final non-success response. The `results` value that the Promise resolves provides a complete description of the results:

```js
{
  connected: true,           // true if the call was answered (final status 200)
  finalStatus: 200,          // status of the final response that was forwarded upstream
  finalResponse: {           // the final response
    time: '...',             // time the response was received
    status: 200,
    msg: {..}                // the SIP response message (a SipMessage object)
  },
  responses: [               // the responses received, along with the address
    {                        // and port they were received from
      address: '10.10.100.1',
      port: 5060,
      msgs: [
        {time: '...', status: 180, msg: {..}}
      ]
    },
    {
      address: '10.10.100.1',
      port: 5060,
      msgs: [
        {time: '...', status: 200, msg: {..}}
      ]
    }
  ]
}
```

There are a bunch of options that we can utilize when proxying a call, but before we take a look at those let's consider the two fundamentally different proxy scenarios that we might encounter:

1. The incoming INVITE has a Request-URI of the drachtio server, and we want to proxy it on towards a next sip uri that we supply in the call to [Srf#proxyRequest](./api/srf.md#srf-proxyrequest).  An example of this use case occurs when we have a drachtio server acting as a load balancer in front of an array of application or media servers.
2. The incoming INVITE has a Request-URI of a remote endpoint, and we want to proxy it on towards that endpoint.  An example of this use case occurs when we have a drachtio server acting as an outbound SIP proxy.

How we handle these two scenarios is governed by whether we supply a sip uri in the call to [Srf#proxyRequest](./api/srf.md#srf-proxyrequest).  In the first example above, we supplied a sip uri in the method call and as a result the drachtio server will do the following:

* If the incoming INVITE had a Request-URI that matches a local address that the drachtio server is listening on, then it will replace the Request-URI in the outbound INVITE to that specified in the method call *and* will forward the INVITE to that address.
* Otherwise, the outbound INVITE will leave the Request-URI unchanged while forwarding the INVITE to the sip uri specified in the method call. 

An implication of this is that we can call [Srf#proxyRequest](./api/srf.md#srf-proxyrequest) without specifying a sip uri at all; in this case, drachtio acts as an outbound proxy and forwards the INVITE towards the Request-URI of the incoming INVITE.

Destinations may be given either as full sip uris or simply as a host or address (with optional port), in which case `sip:` is prepended.

### SIP proxy acting as a load balancer
```js
srf.invite((req, res) => {
  srf.proxyRequest(req, ['sip.example1.com', 'sip2.example1.com'])
    .then((results) => console.log(JSON.stringify(results)) );
});
```
The above example illustrates that we can provide either a string or an Array of strings as the sip uri to proxy an INVITE to.  In the latter case, if the INVITE fails on the first sip server it will then be attempted on the second, and so on until a successful response is received or the list is exhausted.

### SIP outbound proxy
```js
srf.invite((req, res) => {
  srf.proxyRequest(req)
    .then((results) => console.log(JSON.stringify(results)) );
});
```
In the above example there is no need to supply a sip uri if the drachtio server is acting as a simple outbound proxy.

### SIP Proxy options
```js
srf.invite((req, res) => {
  srf.proxyRequest(req, ['sip.example1.com', 'sip2.example1.com'], {
    recordRoute: true,
    followRedirects: true,
    forking: 'simultaneous',
    provisionalTimeout: '2s',
    finalTimeout: '18s',
    headers: {
      'X-Proxied-By': 'drachtio'
    }
  })
    .then((results) => console.log(JSON.stringify(results)) );
});
```
The available options are:

* `recordRoute` (alias: `remainInDialog`): if true, add a Record-Route header and remain in the SIP dialog, i.e. continue to receive and forward subsequent requests within the dialog, including the terminating BYE.  Default: false.
* `followRedirects`: if true, handle 3XX redirect responses by generating a new request as per the Contact header of the response; otherwise, the 3XX response is proxied back upstream.  Default: false.
* `forking`: when multiple destinations are provided, `'sequential'` (the default) attempts them one at a time, while `'simultaneous'` forks the request to all destinations at once.
* `provisionalTimeout`: timeout after which to attempt the next destination if no 100 Trying response has been received, e.g. `'1500ms'` or `'2s'`.
* `finalTimeout`: timeout after which to cancel the current request and attempt the next destination if no final response has been received; same syntax as `provisionalTimeout`.
* `headers`: an object containing SIP headers to add to the proxied request.

See [Srf#proxyRequest](./api/srf.md#srf-proxyrequest) for further details.
