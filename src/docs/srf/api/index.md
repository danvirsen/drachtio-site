# API Reference

The API reference describes every class, method, option, property and event of [drachtio-srf](https://github.com/drachtio/drachtio-srf) 5.x that your application can use.

```js
const Srf = require('drachtio-srf');
const srf = new Srf();
```

The package exports a single class, [Srf](./srf.md). Other classes are reached through static properties on it ([`Srf.Dialog`](./srf.md#srf-dialog), [`Srf.SipError`](./srf.md#srf-siperror), [`Srf.SipMessage`](./srf.md#srf-sipmessage), [`Srf.SipRequest`](./srf.md#srf-siprequest), [`Srf.SipResponse`](./srf.md#srf-sipresponse)), plus some helpers ([`Srf.parseUri`](./srf.md#srf-parseuri), [`Srf.stringifyUri`](./srf.md#srf-stringifyuri), [`Srf.DialogState`](./srf.md#srf-dialogstate), [`Srf.DialogDirection`](./srf.md#srf-dialogdirection)). TypeScript type declarations are included in the package.

::: info Conventions
- In signatures and parameter tables, a name in square brackets (for example `[callback]` or `[opts.headers]`) is optional.
- Many methods support both styles: **if you pass a callback, the method returns the object it was called on (so calls can be chained) and reports the result through the callback. If you leave the callback out, it returns a Promise.** Each method says which style or styles it supports.
:::

## Classes

- [Srf](./srf.md) — connecting to drachtio servers, handling requests, creating dialogs, proxying
- [Dialog](./dialog.md) — an established SIP dialog: sending requests within it, modifying and ending it
- [Request](./request.md) — a SIP request your application receives or sends
- [Response](./response.md) — a SIP response your application sends or receives
- [SipMessage](./sipmessage.md) — header access and properties shared by requests and responses
- [SipError](./siperror.md) — the error you get when a request fails with a SIP status
