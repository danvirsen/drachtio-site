# Introduction

## Getting your kit up and running

[drachtio-srf](https://www.npmjs.com/package/drachtio-srf) (the 'srf' stands for *S*ignaling *R*esource *F*ramework) is the npm module that you will add to your package.json to build SIP server applications using drachtio.

drachtio-srf works in concert with a [drachtio server](https://github.com/drachtio/drachtio-server) process to control and manage SIP calls and events.  So you will need a running instance of a drachtio server somewhere to connect to in order to start developing.  

You can find instructions for [building a drachtio server from scratch here](../server/installing.md), or if you prefer ansible you can find [an ansible role here](https://github.com/drachtio/ansible-role-drachtio), but the easiest way to get started is probably to run a [docker image](https://hub.docker.com/r/drachtio/drachtio-server).

Review the [drachtio server docs](../server/configuring.md) for detailed information on configuring the server.

drachtio-srf requires Node.js 18 or later.

::: info Note
The sample code below assumes that a drachtio server process is running on the localhost and is listening for connections from applications on port 9022 (tcp), which is the server's default.
:::

## Let's do something simple

Let's write a simple app that receives an INVITE and responds with a 486 status with a custom reason.  

First, create a new application and add drachtio-srf as a dependency:
```bash
$ mkdir reject-nice && cd $_
$ npm init
...follow prompts, enter 'app.js' for entry point

$ touch app.js
$ npm install --save drachtio-srf
```

Next, make your app.js to look like this:
```js
const Srf = require('drachtio-srf');
const srf = new Srf();

srf.connect({
  host: '127.0.0.1',
  port: 9022,
  secret: 'cymru'
});

srf.on('connect', (err, hostport) => {
  if (err) return console.log(`error connecting: ${err}`);
  console.log(`connected to a drachtio server listening on: ${hostport}`);
});

srf.invite((req, res) => {
  res.send(486, 'So sorry, busy right now', {
    headers: {
      'X-Custom-Header': 'because why not?'
    }
  });
});
```
Now start your drachtio server or docker image -- in the example above the drachtio server is running locally and listening on the localhost address with default port and secret.  

Once the drachtio server is running, start your app and verify it connects:
```bash
$ node app.js 
connected to a drachtio server listening on: tcp/[::1]:5060,udp/[::1]:5060, \
tcp/127.0.0.1:5060,udp/127.0.0.1:5060,tcp/192.168.200.135:5060,udp/192.168.200.135:5060
```
Now fire up a sip client of some kind (e.g. [Bria](https://www.counterpath.com/bria/), [Blink](http://icanblink.com/), or other), point it at the address your drachtio server is listening on, and place a call.

If everything is communicating properly, the call will get rejected with the reason above and in the drachtio log you should see the SIP trace, including the generated response:

```bash
2018-05-05 13:31:02.879056 send 358 bytes to udp/[127.0.0.1]:57296 at 13:31:02.878925:
SIP/2.0 486 So sorry, busy right now
Via: SIP/2.0/UDP 127.0.0.1:57296;branch=z9hG4bK-524287-1---de4c69061049b867;rport=57296
From: <sip:dhorton@sip.drachtio.org>;tag=5fac7d01
To: <sip:22@sip.drachtio.org>;tag=KjH30DtKFKXcQ
Call-ID: 89373MWI0ODM1YTc2MTc2NThlZDE0MTU1YmRmNDY5OTk0NzM
CSeq: 1 INVITE
Content-Length: 0
X-Custom-Header: because why not?
```
## What did we just do?

OK, so rejecting an incoming call is not particularly exciting, but the main thing we just accomplished was to verify that we have a working drachtio server, and also we illustrated how to connect an application to a drachtio server.

The type of connection made in our example above is called an **inbound** connection; that is, a TCP connection made from the nodejs application acting as a client to the drachtio server process acting as the server.  There is also the possibility of having the drachtio server make an **outbound** connection to a listening application, but that is a [more advanced topic we will cover later](advanced-topics.md#outbound-connections), along with the reasons on why you might want to do that.

By default, the drachtio server process listens for inbound connections on tcp port 9022, but this can be configured to a different port in its configuration file.  Authentication uses a simple plaintext secret, which is also configured in the drachtio server configuration file (the connection itself can optionally be [encrypted using TLS](advanced-topics.md#using-tls-to-encrypt-messages-between-application-and-server)).

In the example above, we listened for the 'connect' event on the `srf` object.  However, it is a **best practice** to also listen for the `error` event, e.g.:
```js
srf
  .on('connect', (err, hostport) => {
    if (err) return console.log(`error connecting: ${err}`);
    console.log(`connected to a drachtio server listening on: ${hostport}`);
  })
  .on('error', (err) => {
    console.log(`Error connecting to drachtio server: ${err}`);
  });

```
The reason for this is that when the connection to the server is lost, the Srf instance emits an `error` event.  If your app has an error handler on the srf instance, the framework will automatically try to reconnect, which is generally what you want in production scenarios.  If there is no error handler, the unhandled `error` event will crash your application.

::: tip Pro tip
Always have an [error](./api/srf.md#srf-event-error) handler on your Srf instance when using inbound connections, so your application will automatically reconnect to the server if the tcp connection is dropped. See [Reconnection and keep-alive options](advanced-topics.md#reconnection-and-keep-alive-options) for tuning the reconnect behavior.
:::

### Where did those other SIP headers come from?
Notice that although our application only provided one SIP header (a custom 'X-' header), the response actually sent by the drachtio server was a normal, fully-formed SIP response.  

This is because the drachtio server process does a lot of the heavy lifting for us when it comes to managing the low-level SIP messaging. Our applications generally do not need to specify values for the common SIP headers, unless for some reason we want to override the behavior of the drachtio server.

By the way, the custom header was, of course, not really necessary and was only done for illustrative purposes in the example above. Neither, for that matter, was the SIP reason we provided: we could have simply sent a standard `SIP/2.0 486 Busy Here` with the following line of code:
```js
res.send(486);
```
And, by the way, we are not limited to adding custom SIP headers to our messages -- we can add standard SIP headers in the same way:
```js
res.send(486, {
  headers: {
    'Subject' : 'my first app'
  }
});
```