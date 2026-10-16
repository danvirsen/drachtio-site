# SipError {#siperror}

`SipError` extends `Error` and represents a final SIP failure response to a request. It is available as [`Srf.SipError`](./srf.md#srf-siperror). [`createUAC()`](./srf.md#srf-createuac), [`createB2BUA()`](./srf.md#srf-createb2bua) and [`dialog.modify()`](./dialog.md#dialog-modify) fail with this error when the far end rejects a request, and [`createUAS()`](./srf.md#srf-createuas) fails with it (status 487) when the caller cancels.

```js
new SipError(status, [reason])
```

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | `'SipError'`. |
| `status` | number | SIP status code. |
| `reason` | string | Reason phrase. Only set if one was supplied. |
| `message` | string | `'Sip non-success response: <status>'`. |
| `res` | [Response](./response.md#response) | The failure response. Set on errors from `createUAC()` and `createB2BUA()`. |

```js
try {
  const uac = await srf.createUAC('sip:1234@10.10.100.1', {localSdp: mySdp});
} catch (err) {
  if (err instanceof Srf.SipError) {
    console.log(`call failed: ${err.status} ${err.reason}`);
  }
  else throw err;
}
```
