```js
// A simple SIP proxy
const Srf = require('drachtio-srf');
const srf = new Srf();

srf.connect({
  host: '127.0.0.1',
  port: 9022,
  secret: 'cymru'
});

srf.invite((req, res) => {
  srf.proxyRequest(req, [
    'sip1.example.com',
    'sip2.example.com'
  ], {
    recordRoute: true,
    followRedirects: true
  });
});
```
