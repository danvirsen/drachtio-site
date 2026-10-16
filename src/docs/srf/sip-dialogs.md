# SIP Dialogs

Conceptually, a SIP dialog is defined in [RFC 3261](https://tools.ietf.org/html/rfc3261) as a relationship between two SIP endpoints that persists for a period time.  Generally speaking, we are referring most often to a multimedia call initiated by a SIP INVITE transaction during which audio and/or video is exchanged. (Later we will discuss an alternative type of dialog created by a SUBSCRIBE transaction).

Within drachtio, a SIP dialog is an object that is created to represent a multimedia session and to allow a developer to manage such sessions: to create them, modify them, and tear them down.

The examples we have shown till now have illustrated how to manage SIP interactions at the SIP message level. However, in most cases the drachtio SIP Dialog API provides a higher-level abstraction that makes it easier for developers to manage sessions.

## User Roles in a Dialog
Some basic terminology is going to be helpful before diving into the API and some examples.

A drachtio application can:

* initiate an INVITE transaction -- in which case we say it is acting as a 'User Agent Client', or UAC,
* respond to an incoming INVITE transaction -- in which case we call it a 'User Agent Server', or UAS, and/or
* *both* receive *and* send an INVITE transaction -- in which case we call it a 'back to back User Agent', or B2BUA

By the way, these are not the only types of applications we can build with drachtio. We can also build:

* a registar -- which is an application that responds to REGISTER requests
* a presence server -- which is an application that responds to SUBSCRIBE requests
* an instant messaging server -- which responds to MESSAGE requests ([see here](https://github.com/davehorton/drachtio-simple-server) for an example of a presence and messaging server)
* a sip proxy -- which is an application that routes and forwards SIP requests

Quite frequently, though, we will find ourselves wanting to build some form of SIP User Agent application, and that is what we will cover in this section.

The dialog API consists of the methods

* [Srf#createUAS](./api/srf.md#srf-createuas),
* [Srf#createUAC](./api/srf.md#srf-createuac), and
* [Srf#createB2BUA](./api/srf.md#srf-createb2bua).

Each of these methods produces a [Dialog](./api/dialog.md#dialog) object when a session is successfully established, which is returned via a callback (if provided) and resolves the Promise returned by each of the above methods (`createB2BUA` produces a pair of dialogs, `{uas, uac}`).

Before we review the above three methods, let's examine the [Dialog](./api/dialog.md#dialog) class itself, and how to work with it.

## Dialog

The Dialog class is an event emitter, and has the following properties, methods, and events.

### properties

* `sip`: an object containing properties that identify the SIP dialog
* `sip.callId`: the SIP Call-Id associated with this dialog
* `sip.remoteTag`: the remote tag associated with the dialog
* `sip.localTag`: the local tag associated with the dialog
* `local`: an object containing properties associated with the local end of the dialog
* `local.sdp`: the local session description protocol
* `local.uri`: the local sip uri
* `local.contact`: the local Contact header
* `remote`: an object containing properties associated with the remote end of the dialog
* `remote.sdp`: the remote session description protocol (updated whenever a new remote offer or answer is received, e.g. on a re-INVITE or in the ACK of a delayed-offer call)
* `remote.uri`: the remote sip uri (taken from the remote party's Contact header)
* `id`: a unique identifier for the dialog with the drachtio framework
* `type`: either 'uas' or 'uac', depending on which side of the dialog we are
* `dialogType`: either 'INVITE' or 'SUBSCRIBE'
* `subscribeEvent`: for a SUBSCRIBE dialog, the value of the Event header in the initial SUBSCRIBE (null for INVITE dialogs)
* `connected`: true while the dialog is active; set to false once the dialog has been terminated
* `onHold`: true if the dialog is currently on hold (because we called `modify('hold')`, or the remote side put us on hold)
* `req`, `res`: the SIP request and response that created the dialog
* `other`: for dialogs created by [Srf#createB2BUA](./api/srf.md#srf-createb2bua), a reference to the paired dialog (i.e., `uas.other === uac` and `uac.other === uas`)

### methods

* [destroy(opts, callback)](./api/dialog.md#dialog-destroy): terminates a dialog, by sending a BYE (in the case of an INVITE dialog), or a NOTIFY with Subscription-State: terminated (in the case of a SUBSCRIBE dialog). `opts.headers` may be used to add headers (e.g. a Reason header) to the BYE or NOTIFY, and `opts.auth` provides credentials in case the request is challenged. Returns a Promise that resolves with the BYE or NOTIFY request that was sent, if no callback is provided.
* [modify(sdp, opts, callback)](./api/dialog.md#dialog-modify): modifies a SIP INVITE dialog by sending a re-INVITE.  The `sdp` parameter can be either the string 'hold' (re-INVITE with the local SDP marked `a=inactive`), 'unhold' (re-INVITE with the local SDP restored to `a=sendrecv`), or a new session description to offer.  `opts.headers` and `opts.auth` may also be provided.  Returns a Promise that resolves with the SDP the remote side answered with in the 200 OK (or rejects with a [SipError](./api/siperror.md#siperror) if the re-INVITE fails).  Only one re-INVITE is sent at a time on a dialog; additional calls to `modify` are queued until the outstanding one completes.
* [request(opts, callback)](./api/dialog.md#dialog-request): sends a SIP request within a dialog.  `opts.method` (an upper-case SIP method name, e.g. 'INFO') is required, and `opts.headers`, `opts.body` and `opts.auth` may optionally be provided. Returns a Promise that resolves with the SIP response received.

::: info Note
If you call one of these methods just as the dialog is ending (for example, your request crosses a BYE from the other side), it fails with `err.code` set to `'ENODIALOG'`.  This is usually harmless, so you can check for it and ignore it.  See [request failure codes](./api/request.md#request-error-codes).
:::

### events

* [destroy(req, reason)](./api/dialog.md#dialog-event-destroy): emitted when the remote end has terminated the dialog.  The `req` parameter represents the SIP request sent from the remote end to terminate the dialog (a BYE, or for a SUBSCRIBE dialog a NOTIFY with Subscription-State: terminated).  (Note: no action is required by the application, as drachtio-srf will have sent a 200 OK to the BYE).
* [ack(req)](./api/dialog.md#dialog-event-ack): emitted when an ACK is received on the dialog -- for example, the ACK to the 200 OK sent by [Srf#createUAS](./api/srf.md#srf-createuas).  In a delayed-offer call, `dialog.remote.sdp` already contains the SDP from the ACK when this event fires.
* [modify(req,res)](./api/dialog.md#dialog-event-modify): emitted when the remote end has sent a re-INVITE with a changed session description protocol.  The application must respond, using the `res` parameter provided.  If there is no listener for this event, drachtio-srf responds automatically with a 200 OK containing the current local SDP.
* [hold(req)](./api/dialog.md#dialog-event-hold): emitted when the remote end has placed the call on hold.  The `req` parameter represents the INVITE on hold sent. (Note: no action is required by the application, as drachtio-srf will have sent a 200 OK with the local SDP changed to `a=recvonly`).
* [unhold(req)](./api/dialog.md#dialog-event-unhold): emitted when the remote end has taken the call off hold.  The `req` parameter represents the INVITE off hold sent. (Note: no action is required by the application, as drachtio-srf will have sent a 200 OK to the request).
* [refresh(req)](./api/dialog.md#dialog-event-refresh): emitted when the remote end has sent a refreshing re-INVITE that doesn't change the session.  (Note: no action is required by the application, as drachtio-srf will have sent a 200 OK to the request).
* [info(req, res)](./api/dialog.md#dialog-event-info)
* [message(req, res)](./api/dialog.md#dialog-event-message)
* [notify(req, res)](./api/dialog.md#dialog-event-notify)
* [options(req, res)](./api/dialog.md#dialog-event-options)
* [publish(req, res)](./api/dialog.md#dialog-event-publish)
* [refer(req, res)](./api/dialog.md#dialog-event-refer)
* [update(req, res)](./api/dialog.md#dialog-event-update): these events are emitted when a SIP request of the specified type is received within a dialog.  The application must respond, using the `res` parameter provided.  If the application does not have a listener registered for the event, then drachtio-srf will automatically respond with a 200 OK (in the case of an UPDATE carrying an SDP, the 200 OK will contain the current local SDP).
* [subscribe(req, res)](./api/dialog.md#dialog-event-subscribe): emitted when a refreshing SUBSCRIBE is received within a SUBSCRIBE dialog.  The application must respond, using the `res` parameter provided.  If there is no listener for this event, drachtio-srf responds with a 489 Bad Event.
* [unsubscribe(req)](./api/dialog.md#dialog-event-unsubscribe): emitted when a SUBSCRIBE with Expires: 0 is received within a SUBSCRIBE dialog.  (Note: no action is required by the application, as drachtio-srf will have sent a 202 Accepted).

::: tip Pro tip
While there are many operations you might want to perform on a Dialog object, the one thing you should *always* do is to listen for the 'destroy' event.  You should attach a listener for 'destroy' whenever you create a new dialog.  This will tell you when the remote side has hung up, and after this you will no longer be able to operate on the dialog.
:::

### Handling re-INVITEs

When a re-INVITE arrives, drachtio-srf looks at the new SDP to decide which event to emit.  The 'refresh', 'hold' and 'unhold' events are only emitted if you have a listener for them:

1. 'refresh': the session is unchanged (same session id and version on the `o=` line);
2. 'hold': the only change is `a=sendrecv` becoming `a=sendonly`;
3. 'unhold': the dialog is on hold and the SDP changes back again;
4. 'modify': anything else.  If you have no 'modify' listener, drachtio-srf answers with a 200 OK containing the current local SDP.

For 'refresh', 'hold' and 'unhold', drachtio-srf sends the 200 OK for you.  For 'modify', you send the response.  `dialog.remote.sdp` already holds the new offer when the event fires; if you answer with a different SDP, update `dialog.local.sdp` yourself.

```js
dialog.on('modify', async(req, res) => {
  try {
    const sdp = await getAnswerSomehow(req.body);
    dialog.local.sdp = sdp;
    res.send(200, {body: sdp});
  } catch (err) {
    res.send(488);
  }
});
```

## UAS

Whew!  With that background under our belt we can finally get to the meat of the matter -- creating and managing calls.

When we receive an incoming call and connect it to an IVR, or to a conference bridge, our application is acting as a UAS. Let's look at these scenarios first.

The one piece of information we need when acting as a UAS is the session description protocol (sdp) that we want to offer in our 200 OK.  Creating media endpoints is outside the scope of drachtio-srf, so the examples below assume that our application has obtained them through other means.

::: info Note
Check out [drachtio-fsmrf](https://www.npmjs.com/package/drachtio-fsmrf), which is a npm module that can be used with drachtio-srf to control media resources on a [Freeswitch](https://freeswitch.com/) media server in order to provide IVR and conferencing features to drachtio applications.
:::

```js
srf.invite((req, res) => {
  const sdp = 'some-session-description-protocol';
  srf.createUAS(req, res, {
    localSdp: sdp
  })
    .then((dialog) => {
      console.log('successfully created UAS dialog');
      dialog.on('destroy', () => console.log('remote party hung up'));
    })
    .catch((err) => {
      console.log(`Error creating UAS dialog: ${err}`);
    });
});
```
In the example above, the local sdp is provided as a string, but we can alternatively provide a function that returns the sdp, or a Promise which resolves to a string value representing the session description protocol.  This is useful when we have to perform some sort of asynchronous operation to obtain the sdp.
```js
function getMySdp() {
  return doSomeNetworkOperation()
    .then((results) => {
      return results.sdp;
    });
}
srf.invite((req, res) => {
  srf.createUAS(req, res, {
    localSdp: getMySdp
  })
    .then((dialog) => { .. })
    .catch((err) => { .. });
});
```
Of course, we can supply SIP headers in the usual manner:
```js
srf.invite((req, res) => {
  srf.createUAS(req, res, {
    localSdp: sdp,
    headers: {
     'User-Agent': 'drachtio/iechyd-da',
     'X-Linked-UUID': '1e2587c'
    }
  })
    .then((dialog) => { .. });
});
```
If [Srf#createUAS](./api/srf.md#srf-createuas) fails to create a dialog for some reason, an error object will be returned via either callback or the Promise.  If the failure is due to a SIP non-success status code, then a [SipError](./api/siperror.md#siperror) will be returned.  In the UAS scenario, the only time this will happen is if the call is canceled by the caller before we answer it, in which case a '487 Request Terminated' will be the final SIP status.  Other failures produce an ordinary `Error`.
```js
srf.invite((req, res) => {
  srf.createUAS(req, res, {
    localSdp: sdp,
    headers: {
     'User-Agent': 'drachtio/iechyd-da',
     'X-Linked-UUID': '1e2587c'
    }
  })
    .then((dialog) => { .. })
    .catch((err) => {
      if (err instanceof Srf.SipError && err.status === 487) {
        console.log('call canceled by caller');
      }
    });
});
```

Finally, as noted above, [Srf#createUAS](./api/srf.md#srf-createuas) can be invoked with a callback as an alternative to Promises.  In most of the examples in this document we will use Promises, but an example of using a callback is presented below.

```js
srf.invite((req, res) => {
  const sdp = 'some-session-description-protocol';
  srf.createUAS(req, res, {
    localSdp: sdp
  }, (err, dialog) => {
    if (err) console.log(`Error creating UAS dialog: ${err}`);
    else {
      console.log('successfully created UAS dialog');
      dialog.on('destroy', () => console.log('remote party hung up'));
    }
  });
});
```

::: info Note
The dialog is delivered as soon as the 200 OK has been sent; it does not wait for the ACK.  If you need to know when the ACK arrives, listen for the dialog's 'ack' event.
:::

## UAC

When we initiate a dialog by sending an INVITE, we are acting as a UAC.  We use the [Srf#createUAC](./api/srf.md#srf-createuac) method to accomplish this.  Just as with [Srf#createUAS](./api/srf.md#srf-createuas), either a callback approach or a Promise-based approach is supported.

In the simplest example, we can provide only the Request-URI we want to send to, and the session description protocol we are offering in the INVITE in that example:
```js
const mySdp = getSdpSomehow(); // populated somehow with SDP we want to offer
srf.createUAC('sip:1234@10.10.100.1', {localSdp: mySdp})
  .then((dialog) => {
    dialog.on('destroy', () => console.log('called party ended call'));
  })
  .catch((err) => {
    console.log(`call failed with ${err}`);
  });
```

::: tip Pro tip
We can specify the Request-Uri either a full sip uri, as above, or simply provide an ip address (or ip address:port, if we want to send to a non-default SIP port).  Alternatively, the Request-URI can be passed as `opts.uri` and the first parameter omitted, i.e. `srf.createUAC({uri: 'sip:1234@10.10.100.1', localSdp: mySdp})`.
:::

### What did drachtio server do in all this?
In the example above, we supplied only the Request-URI and body of the INVITE, so the drachtio server must have done quite a bit in terms of filling out the rest of the message and managing various aspects of the transaction.

In fact, the drachtio server would have done all of the following to create the outgoing INVITE:

* generated a (unique) SIP Call-ID and a CSeq
* generated the appropriate Via header (pro tip: never provide a Via: header, always let drachtio generate that)
* generated the From header (with no user element in the URI), and generated a From tag
* generated the To header (according to the Request-URI we provided)
* generated a Contact header, based on the Request-URI and the address:port(s) that the server is listening on for SIP messages
* examined the body that we provided and -- seeing that it was an sdp -- created a Content-Type of 'application/sdp'
* calculated the Content-Length header (pro tip: never provide a Content-Length: header, always let drachtio generate that)

It would have then sent the INVITE, and managed any provisional and final responses.  It would have generated the final ACK request as well.  If a reliable provisional response were received, it would have responded with the required PRACK request.

Beyond this basic usage, there are several other common patterns.  Let's look at some of them.

### Receiving provisional responses

When we send out an INVITE, we may get some provisional (1XX) responses back before we get a final response.  In the example above, we did not care to do anything with these provisional responses, but if we want to receive them we can add a callback that will be invoked when we receive a provisional response.  This callback, named `cbProvisional`, along with another we will describe shortly, are provided in an optional Object parameter as shown below.

```js
srf.createUAC('sip:1234@10.10.100.1', {localSdp: mySdp}, {
    cbProvisional: (res) => console.log(`got provisional response: ${res.status}`)
  })
  .then((dialog) => {
    dialog.on('destroy', () => console.log('called party ended call'));
  })
  .catch((err) => {
    console.log(`call failed with ${err.status}`);
  });
```

::: info Note
If the INVITE fails, a [SipError](./api/siperror.md#siperror) object will be returned, and the final SIP non-success status can be retrieved from `err.status` as shown above (the reason phrase is available as `err.reason`, and the full SIP response as `err.res`).
:::

### Canceling an INVITE we sent

Sometimes, we may want to cancel an INVITE that we have sent before it is answered.  Related to this, we may simply want to get access to details of the actual INVITE that was sent out over the wire.  To do this, we can provide a `cbRequest` callback in the callback object mentioned above.  This callback is invoked with the signature `(err, req)`, where `req` is an object representing the INVITE that was sent over the wire.  If we later want to cancel the INVITE, we simply call `req.cancel()`.

```js
let invite, dlg;
srf.createUAC('sip:1234@10.10.100.1', {localSdp: mySdp}, {
    cbRequest: (err, req) => invite = req,
    cbProvisional: (res) => console.log(`got provisional response: ${res.status}`)
  })
  .then((dialog) => {
    dlg = dialog;
    dialog.on('destroy', () => console.log('called party ended call'));
  })
  .catch((err) => {
    console.log(`call failed with ${err}`);
  });

someEmitter.on('some-event', () => {
  // something happened to make us want to cancel the call
  if (!dlg && invite) invite.cancel();
});
```

When the INVITE is canceled, the Promise will be rejected with a [SipError](./api/siperror.md#siperror) having a status of 487.

### Authentication

If we send an INVITE that is challenged (with either a 401 Unauthorized or a 407 Proxy Authentication Required), we can have the drachtio framework handle this if we provide the username and password in the `opts.auth` parameter:

```js
const mySdp = getSdpSomehow(); // populated somehow with SDP we want to offer
srf.createUAC('sip:1234@10.10.100.1', {
  localSdp: mySdp,
  auth: {
    username: 'dhorton',
    password: 'foobar'
  }
})
  .then((dialog) => {
    dialog.on('destroy', () => console.log('called party ended call'));
  })
  .catch((err) => {
    console.log(`call failed with ${err}`);
  });
```

Alternatively, `opts.auth` can be a function that will be invoked with the signature `(req, res, callback)` when a challenge is received, where `req` is the request that was sent and `res` is the response containing the digest challenge.  The function should invoke `callback(err, username, password)`.  This is useful when the credentials to use depend on the realm or other details of the challenge.

The credentials are remembered on the resulting dialog, and are used automatically if a subsequent in-dialog request (such as a BYE or a re-INVITE) is challenged.

### Sending through an outbound SIP proxy

If we want the INVITE to be sent through an outbound SIP proxy, rather than directly to the endpoint specified in the Request-URI, we can specify an `opts.proxy` parameter:

```js
const mySdp = getSdpSomehow(); // populated somehow with SDP we want to offer
srf.createUAC('sip:1234@10.10.100.1', {
  localSdp: mySdp,
  proxy: 'sip:proxy.enterprise.com'
})
  .then((dialog) => {
    dialog.on('destroy', () => console.log('called party ended call'));
  })
  .catch((err) => {
    console.log(`call failed with ${err}`);
  });
```

### Specifying calling number or called number

If we want to specify the calling party number to use in the From header of the INVITE, and/or the called party number to use in the To header as well as the Request-URI, we can do so simply like this:

```js
const mySdp = getSdpSomehow(); // populated somehow with SDP we want to offer
srf.createUAC('sip:1234@10.10.100.1', {
  localSdp: mySdp,
  callingNumber: '+18584083089',
  callingName: 'Dave Horton',
  calledNumber: '+15083345988'
})
  .then((dialog) => {
    dialog.on('destroy', () => console.log('called party ended call'));
  })
  .catch((err) => {
    console.log(`call failed with ${err}`);
  });
```

The optional `opts.callingName` parameter sets the display name in the From header.

::: tip Pro tip
Where possible, use this approach of providing `opts.callingNumber` rather than trying to provide a full From header.
:::

::: tip Pro tip
If you *really* want to provide the full From header, for the host part of the uri use the string 'localhost'.  The drachtio server will handle this by replacing the host value with the proper IP address for the server.
:::

### Following redirects

By default, a 3XX redirect response to our INVITE is treated as a failure, and the Promise is rejected with a [SipError](./api/siperror.md#siperror) carrying the 3XX status.  If we set `opts.followRedirects` to true, drachtio-srf will instead automatically send a new INVITE to the uri in the Contact header of the redirect response (up to a maximum of 4 redirects).

If `opts.keepUriOnRedirect` is also set to true, the new INVITE keeps the original Request-URI and is instead sent via the redirect Contact (as if it were an outbound proxy).

```js
srf.createUAC('sip:1234@10.10.100.1', {
  localSdp: mySdp,
  followRedirects: true
})
  .then((dialog) => { .. });
```

### Sending a 3PCC INVITE

A scenario known as third-party call control (3PCC) occurs when a UAC sends an INVITE with no body -- i.e., no session description protocol is initially offered.  In this call flow, after the offer is received in the 200 OK response from the B party, the UAC sends its sdp in the ACK to establish the media flows.

To accomplish this, the [Srf#createUAC](./api/srf.md#srf-createuac) can be used.  However, because of the need to specify an SDP in the ACK, the application must take additional responsibility for generating the ACK.

Furthermore, instead of delivering a Dialog, the Promise (or callback) will render an object containing the following properties:

* `sdp`: the sdp received in the 200 OK from the B party,
* `res`: the 200 OK response received from the B party,
* `ack`: a function that the application must call, providing the SDP to be included in the ACK as the first parameter.  The function returns a Promise that resolves to the Dialog created by the ACK, and
* `destroy`: a function that the application can call instead of `ack` if it decides to abandon the call; it ACKs the 200 OK and then immediately sends a BYE, so that the B party is not left hanging.

With that as background, let's see an example:

```js
srf.createUAC('sip:1234@10.10.100.1', {
  callingNumber: '+18584083089',
  calledNumber: '+15083345988',
  noAck: true
})
  .then((obj) => {
    console.log(`received sdp offer ${obj.sdp} from B party`);
    const mySdp = allocateSdpSomehow();
    return obj.ack(mySdp);
  })
  .then((dialog) => {
    dialog.on('destroy', () => console.log('called party ended call'));
  })
  .catch((err) => {
    console.log(`call failed with ${err}`);
  });
```
Note a few things in this example:

* There was no `opts.localSdp` parameter in the call to [Srf#createUAC](./api/srf.md#srf-createuac): the absence of a body signals the drachtio framework that we are intending a 3PCC scenario.
* The use of `opts.noAck` indicates that we do *not* want the framework to generate the ACK for us, and that instead we will explicitly call the `obj.ack()` function to take responsibility for that.

There is also an alternative 3PCC special case where you simply want the call established without supplying an SDP of your own, and will later establish the desired media flows with a re-INVITE.  In that case, you can simply remove the `opts.noAck` parameter and the Promise/callback will deliver the completed dialog as in the normal case -- the framework will generate the ACK for you, answering with a copy of the SDP received from the B party marked `a=recvonly`.

```js
srf.createUAC('sip:1234@10.10.100.1', {
  callingNumber: '+18584083089',
  calledNumber: '+15083345988'
})
  .then((dialog) => {
    console.log('created dialog');
    dialog.on('destroy', () => console.log('called party ended call'));
  })
  .catch((err) => {
    console.log(`call failed with ${err}`);
  });
```

A similar approach can be used on an established dialog: calling `dialog.modify({noAck: true})` sends a re-INVITE with no SDP, and the Promise then resolves with an object `{sdp, ack}`, where `sdp` is the offer received in the 200 OK and `ack(sdp)` is a function the application must call to send the ACK containing its answer.

## B2BUA

When we receive an incoming INVITE (the A leg), and then send a new outgoing INVITE on a different SIP transaction (the B leg), we are acting as a back to back user agent. We use the [Srf#createB2BUA](./api/srf.md#srf-createb2bua) method to accomplish this.  Once again, either a callback approach or a Promise-based approach is supported.

As with the UAC scenario, the simplest usage is to provide the Request-URI to send the B leg to and the sdp to offer on the B leg (if `opts.localSdpB` is not provided, the SDP received on the A leg is offered on the B leg).  If successful, our application receives two SIP dialogs: a UAS dialog (the A leg) and a UAC dialog (the B leg).

```js
srf.invite((req, res) => {
  srf.createB2BUA(req, res, 'sip:1234@10.10.100.1', {localSdpB: req.body})
    .then(({uas, uac}) => {
      console.log('call successfully connected');

      // when one side hangs up, we hang up the other
      uas.on('destroy', () => uac.destroy());
      uac.on('destroy', () => uas.destroy());
    })
    .catch((err) => console.log(`call failed to connect: ${err}`));
});
```

A number of things are handled automatically for us by [Srf#createB2BUA](./api/srf.md#srf-createb2bua):

* unless we specify otherwise (via `opts.callingNumber`, `opts.callingName`, `opts.calledNumber`, or explicit From/To headers in `opts.headers`), the calling number and name and the called number of the A leg are carried over to the B leg,
* provisional responses received on the B leg are relayed to the A leg (including reliable provisional responses),
* a final non-success response on the B leg is relayed to the A leg, and
* if the A leg is canceled, the B leg is canceled as well.

Beyond this simple example, there are many options.  Let's look at some of them:

### Copying headers from the A leg onto the B leg
It's quite common for us to want to include on the B leg INVITE some of the headers that we received on the A leg; vice-versa, we may want to include on the A leg response some of the headers that we received on the B leg response.

This can be achieved with the `opts.proxyRequestHeaders` and the `opts.proxyResponseHeaders` properties in the optional `opts` parameter.  If provided, these should include an array of header names that should be copied from one to the other.  The special value 'all' can also be used to copy all headers (see [proxyRequestHeaders and proxyResponseHeaders](sip-messages.md#the-proxyrequestheaders-and-proxyresponseheaders-options)).

The example below illustrates a B2BUA app that wants to pass authentication headers between endpoints

```js
srf.invite((req, res) => {
  srf.createB2BUA(req, res, 'sip:1234@10.10.100.1', {
    localSdpB: req.body,
    proxyRequestHeaders: ['Proxy-Authorization', 'Authorization'],
    proxyResponseHeaders: ['WWW-Authenticate', 'Proxy-Authenticate']
  })
    .then(({uas, uac}) => {
      console.log('call successfully connected');

      // when one side hangs up, we hang up the other
      uas.on('destroy', () => uac.destroy());
      uac.on('destroy', () => uas.destroy());
    })
    .catch((err) => console.log(`call failed to connect: ${err}`));
});
```

Additional headers can be supplied with `opts.headers` (added to the B leg INVITE) and `opts.responseHeaders` (added to the responses sent on the A leg).  `opts.responseHeaders` can either be an object containing headers, or a function with signature `(uacRes, headers)` that returns an object with the headers to add, where `uacRes` is the response received on the B leg and `headers` are the headers that have been set so far for the A leg response.

### Obtaining the UAC dialog as soon as possible
When the [Srf#createB2BUA](./api/srf.md#srf-createb2bua) completes successfully, it provides us the two dialogs that have been established.

However, in rare cases it may be desirable to receive the UAC dialog as soon as it is established -- that is, as soon as we have received a 200 OK from the B party, before we have sent the 200 OK back to the A party, and before the [Srf#createB2BUA](./api/srf.md#srf-createb2bua) method has resolved the Promise that it returns.

For this need, similar to [Srf#createUAC](./api/srf.md#srf-createuac), there is an optional callback object that contains a callback named `cbFinalizedUac` that, if provided, is invoked with the UAC dialog as soon as it is created.  (Note: the `cbProvisional` and `cbRequest` callbacks are also available).

```js
srf.invite((req, res) => {
  srf.createB2BUA(req, res, 'sip:1234@10.10.100.1', {
    localSdpB: req.body
  }, {
    cbFinalizedUac: (uac) => {
      console.log(`successfully connected to B party at ${uac.remote.uri}`);
    }
  })
    .then(({uas, uac}) => {
      console.log('call successfully connected');

      // when one side hangs up, we hang up the other
      uas.on('destroy', () => uac.destroy());
      uac.on('destroy', () => uas.destroy());
    })
    .catch((err) => console.log(`call failed to connect: ${err}`));
});
```
### Modifying SDP offered to A leg in SIP response

By default, [Srf#createB2BUA](./api/srf.md#srf-createb2bua) will respond with a 200 OK to the A leg INVITE with the sdp that it received from the B party in the 200 OK on the B leg (and likewise for any provisional responses carrying SDP).  In other words, it simply proxies the session description protocol answer from B back to A.

Sometimes, however, it is desirable to transform or modify the SDP received on the B leg before sending it back on the A leg.  For this purpose, the `opts.localSdpA` parameter is available.  This parameter can either be a string, containing the sdp to offer in the 200 OK back to the A leg, or it can be a function returning the sdp (or a Promise that resolves to the sdp) to return in the 200 OK to the A leg.  The function has the signature `(sdpB, res)`, where `sdpB` is the session description we received from the B party, and `res` is the response object we received on the B leg.

Rather than include an example here, please refer to the source code for the [drachtio-b2b-media-proxy](https://github.com/davehorton/drachtio-b2b-media-proxy/blob/master/app.js) application, which is a simple B2BUA that uses [rtpengine](https://github.com/sipwise/rtpengine) to proxy the media.  This is a great example of when you would want to transform the SDP from B before returning the final session description offer to A.

### Late offer (no SDP on the A leg)

If the incoming INVITE has no SDP and we don't provide `opts.localSdpB`, [Srf#createB2BUA](./api/srf.md#srf-createb2bua) sends the B leg INVITE without SDP too.  The B party's offer (in its 200 OK) is relayed to the A party, and A's answer (in its ACK) is passed on in the ACK on the B leg.  If you want to change that answer, `opts.localSdpB` can be a function: it is called with the SDP from the A leg ACK and returns the SDP (or a Promise resolving to the SDP) to send in the B leg ACK.  The Promise resolves once both ACKs have been sent.

### Choosing not to propagate failure from B leg

By default, if we get a final SIP non-success from the B party it will be propagated back to the A party.  There are times where we would prefer not to do so; for instance, if having failed to connect the A party to one endpoint or phone number, we would now wish to try another.

Setting `opts.passFailure` to value of false enables this behavior.

```js
srf.invite((req, res) => {
  srf.createB2BUA(req, res, 'sip:1234@10.10.100.1', {localSdpB: req.body, passFailure: false})
    .then(({uas, uac}) => {
      console.log('call connected to primary destination');
    })
    .catch((err) => {
      // try backup if we got a sip non-success response and the caller did not hang up
      if (err instanceof Srf.SipError && err.status !== 487) {
        console.log(`failed connecting to primary, will try backup: ${err}`);
        srf.createB2BUA(req, res, 'sip:1234@10.10.100.2', {
          localSdpB: req.body
        })
          .then(({uas, uac}) => {
            console.log('call connected to backup destination');
          })
          .catch((err) => {
            console.log(`failed connecting to backup uri: ${err}`);
          });
      }
    });
});
```
Note that we had to check that the reason for the failure connecting our first attempt was not a 487 Request Terminated, because this is the error we receive when the caller (A party) hung up before we connected the B party.  In that case, we no longer would want to attempt a backup destination.

This also answers a related question you may have had: what happens when the A party hangs up before connected, and does our app need to do anything specifically to cancel the B leg when the A leg cancels?  The answer to the latter is no, the drachtio framework will automatically cancel the B leg if the A leg is canceled.

Similarly, setting `opts.passProvisionalResponses` to false prevents provisional responses received on the B leg from being relayed to the A leg.

## Tracking dialog state

[Srf#createUAS](./api/srf.md#srf-createuas), [Srf#createUAC](./api/srf.md#srf-createuac) and [Srf#createB2BUA](./api/srf.md#srf-createb2bua) all accept an optional `opts.dialogStateEmitter`, which is an EventEmitter that the application provides.  If it has a listener for the 'stateChange' event, drachtio-srf will emit that event as the INVITE dialog progresses through the states defined in [RFC 4235](https://tools.ietf.org/html/rfc4235#section-3.7.1).  This can be used, for instance, to implement a dialog event package (`Event: dialog`) notifier for busy lamp field (BLF) functionality.

The 'stateChange' event is emitted with an object containing the following properties:

* `state`: one of the values of `Srf.DialogState`: 'trying', 'proceeding', 'early', 'confirmed', 'terminated', 'rejected' or 'cancelled'
* `direction`: one of the values of `Srf.DialogDirection`: 'initiator' or 'recipient'
* `aor`: the address of record (user@host) the dialog relates to
* `callId`, `localTag`, `remoteTag`: identifiers of the dialog
* `id`: a unique identifier generated for the dialog

```js
const Emitter = require('events');
const dialogStateEmitter = new Emitter();
dialogStateEmitter.on('stateChange', (state) => {
  console.log(`dialog ${state.id} for ${state.aor} is now ${state.state}`);
});

srf.invite((req, res) => {
  srf.createB2BUA(req, res, 'sip:1234@10.10.100.1', {dialogStateEmitter})
    .then(({uas, uac}) => { .. });
});
```

## Subscribe Dialogs

SUBSCRIBE requests also establish SIP Dialogs, as per [RFC 6665](https://tools.ietf.org/html/rfc6665).

A UAC (the _subscriber_) sends a SUBSCRIBE request with an Event header indicating the event that is being subscribed to, and the UAS (the _notifier_) responds with a 202 Accepted response.  The UAS should then immediately send a NOTIFY to the UAC of the current state of the requested resource.  To terminate a SUBSCRIBE dialog, the UAS sends a NOTIFY request with Subscription-State: terminated; while a UAC would send another SUBSCRIBE with an Expires: 0.

The dialog produced by the [Srf#createUAS](./api/srf.md#srf-createuas) method will be a SUBSCRIBE dialog if the request was a SUBSCRIBE.  While the [Srf#createUAS](./api/srf.md#srf-createuas) method call will send a 202 Accepted, it does *not* send the initial NOTIFY request that should follow -- the application must do that, since the content can only be determined by the application itself.

```js
srf.subscribe((req, res) => {
  srf.createUAS(req, res, {
    headers: {'Expires': req.get('Expires')}
  })
    .then((dialog) => {
      dialog.on('destroy', () => console.log('remote party terminated dialog'));

      // refreshing SUBSCRIBEs within the dialog are delivered as 'subscribe' events
      dialog.on('subscribe', (req, res) => res.send(202, {headers: {'Expires': req.get('Expires')}}));

      // SUBSCRIBE with Expires: 0 (a 202 Accepted has already been sent)
      dialog.on('unsubscribe', (req) => console.log('subscriber unsubscribed'));

      // send initial NOTIFY
      const myContent = 'some content reflecting current resource state..';

      return dialog.request({
        method: 'NOTIFY',
        headers: {
          'Subscription-State': 'active',
          'Event': req.get('Event'),
          'Content-Type': 'application/pidf+xml' // or whatever
        },
        body: myContent
      });
    });
});
```

::: tip Pro tip
If you need to query a dialog to see whether it is an INVITE or a SUBSCRIBE dialog, you can use the `dialogType` (read-only) property of the Dialog object to determine that.
:::

Calling `destroy()` on a SUBSCRIBE dialog sends a NOTIFY with Subscription-State: terminated (and the Event header of the subscription) to the subscriber.

The [Srf#createUAC](./api/srf.md#srf-createuac) method can also be used to generate a SUBSCRIBE dialog as a UAC/subscriber.  To do this, `opts.method` should be set to 'SUBSCRIBE'.  The dialog is created when a 202 Accepted (or 200 OK) response is received.

```js
srf.createUAC('sip:resource@example.com', {
    method: 'SUBSCRIBE',
    headers: {
      'From': '<sip:user@localhost>',
      'Event': 'presence',
      'Expires': 3600
    }
  })
  .then((dialog) => {
    dialog.on('destroy', () => console.log('remote party ended dialog'));

    dialog.on('notify', (req, res) => {
      res.send(200);

      console.log(`received NOTIFY for event ${req.get('Event')}`);
      if (req.body) {
        console.log(`received content of type ${req.get('Content-Type')}: ${req.body}`);
      }
    });
  });
```

::: info Note
Note in the example above the use of 'localhost' as the host part of the uri of the From header.  As mentioned earlier, this will cause the drachtio server to replace this with the appropriate IP address of the server.
:::

When the notifier sends a NOTIFY with Subscription-State: terminated for the subscription, the dialog is ended and a 'destroy' event is emitted.
