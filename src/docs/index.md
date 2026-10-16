---
title: Documentation
---

<script setup>
import versions from '../.vitepress/versions.json';
</script>

# Documentation

drachtio has two parts:

- **[drachtio server](./server/installing.md)**: a high-performance SIP server, written in C++, that handles the SIP protocol and passes requests to your applications.
- **[drachtio-srf](./srf/introduction.md)**: a Node.js framework for writing those applications, with a middleware-style API like the web frameworks you already know.

This documentation covers **drachtio-server {{ versions['drachtio-server'] }}** and **drachtio-srf {{ versions['drachtio-srf'] }}**.

## Quick start

```bash
# Run a drachtio server (listens for SIP on 5060 and for applications on 9022)
docker run -d --name drachtio --net=host drachtio/drachtio-server

# Install drachtio-srf (requires Node.js 18 or later)
npm install drachtio-srf
```

Then write your first application:

```javascript
const Srf = require('drachtio-srf');
const srf = new Srf();

srf.connect({ host: '127.0.0.1', port: 9022, secret: 'cymru' });

srf.invite(async(req, res) => {
  try {
    const dialog = await srf.createUAS(req, res, { localSdp: mySdp });
    dialog.on('destroy', () => console.log('caller hung up'));
  } catch (err) {
    console.error(`failed to answer call: ${err}`);
  }
});
```

## Where to go next

- **[Installing](./server/installing.md)**, **[running](./server/running.md)** and **[configuring](./server/configuring.md)** the drachtio server.
- **[Introduction to drachtio-srf](./srf/introduction.md)**: your first application, step by step.
- **[SIP Dialogs](./srf/sip-dialogs.md)**: answering calls, placing calls and building B2BUAs.
- **[API Reference](./srf/api/index.md)**: every class, method, option and event in drachtio-srf.
