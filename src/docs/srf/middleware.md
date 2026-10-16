# Middleware

drachtio-srf is a middleware framework.  As we saw above, we handle SIP INVITEs using `srf.invite(handler)` where our handler function is invoked with `(req, res)` and the arguments provided are objects that represent the incoming SIP request and the SIP response the application will send, respectively.  

All of the SIP methods are routed similarly, e.g.
```js
srf.register((req, res) => {...handle REGISTERs});

srf.options((req, res) => {...handle OPTIONS});

srf.subscribe((req, res) => {...handle SUBSCRIBE}); //...etc
```

::: info Note
Installing a handler for a SIP method (e.g. `srf.register(...)`) is also what tells the drachtio server that your application wants to receive requests of that type.  The server will not deliver requests to your application for methods that you have not installed a handler (or method-scoped middleware) for.
:::

drachtio middleware can also be installed via the `.use` method.  The middleware can be globally applied to all requests, or can be scoped by method.  Middleware functions are invoked with `(req, res, next)` and must either send a response or call `next()` to pass control to the next middleware or handler in the stack.  

Below is an example where we use global middleware to log all requests, and a second middleware that parses incoming REGISTER requests and attaches the details of the registration to the `req` object.
```js
const Srf = require('drachtio-srf');
const srf = new Srf();
const registrationParser = require('drachtio-mw-registration-parser');

srf.use((req, res, next) => {
  console.log(`incoming ${req.method} from ${req.source_address}`);
  next();
});
srf.use('register', registrationParser);

srf.register((req, res) => {
  // middleware has populated req.registration
  console.log(`registration info: ${JSON.stringify(req.registration)}`);

    // {
    //    type: 'register' or 'unregister'
    //    expires: expires value in either Contact or Expires header
    //    contact: array of parsed Contact header values
    //    aor: address-of-record being registered
    // } ;

  res.send(200);
});
```
Middleware and handlers are invoked in the order they were installed.  

If no middleware or handler sends a response, the framework responds with a `404 Not Found` (a few methods, such as ACK, are [handled differently](./api/srf.md#srf-method-handlers)).

::: info Note
Requests that arrive within a SIP dialog that was created by `srf.createUAS`, `srf.createUAC` or `srf.createB2BUA` (for example, a BYE or re-INVITE) are delivered to the associated [Dialog](./api/dialog.md#dialog) object rather than to your middleware and request handlers.
:::

### Error handling middleware

As with Express, a middleware function with four arguments `(err, req, res, next)` is treated as an error handler.  If a middleware function throws an exception or calls `next(err)`, the remaining normal middleware is skipped and control passes to the next error handler.  If there is no error handler that sends a response, the framework logs the error and responds with a 500 (or with `err.status`, if the error provides one).
```js
srf.use((req, res, next) => {
  if (!isAllowed(req.source_address)) return next(new Error('not allowed'));
  next();
});

srf.invite((req, res) => {..});

srf.use((err, req, res, next) => {
  console.log(`error handling ${req.method}: ${err.message}`);
  res.send(403);
});
```

Example middleware include:

* [drachtio-mw-digest-auth](https://github.com/drachtio/drachtio-mw-digest-auth) - implements server-side digest authentication, per [RFC 2617](https://www.ietf.org/rfc/rfc2617.txt)
* [drachtio-mw-registration-parser](https://github.com/drachtio/drachtio-mw-registration-parser) - parses REGISTER requests and populates `req.registration`
