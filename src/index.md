---
layout: home
title: drachtio
titleTemplate: The open source SIP application server framework

hero:
  name: drachtio
  text: The Node.js framework for SIP server applications
  tagline: We make SIP server applications as easy to build as web apps.
  actions:
    - theme: brand
      text: Get started
      link: /docs/srf/introduction
    - theme: alt
      text: See the docs
      link: /docs/
    - theme: alt
      text: View on GitHub
      link: https://github.com/drachtio
---

<div class="home-section">
<div>

<h2>For developers</h2>

If you've used any of the popular Node.js web application frameworks, learning drachtio will be a breeze. Once you've installed a drachtio server, you write your application logic entirely in Node.js, using a familiar middleware pattern.

[See the docs →](/docs/)

</div>
<img class="home-section-image" src="/images/voip.png" alt="">
</div>

<div class="home-section home-section-single">
<div>

<h2>For service providers</h2>

The distributed architecture means that application logic can be managed, deployed and scaled completely independently of the SIP servers that process calls. Separating application logic from SIP server processes simplifies operations and aligns your team's responsibilities.

The cloud-friendly architecture lets you deploy applications into clusters such as Kubernetes, while SIP servers are managed separately in their own autoscaling groups. Integration with tools like [Homer](/docs/server/configuring#capture-server) for SIP capture and [Prometheus](/docs/server/configuring#monitoring-section) for metrics makes drachtio easy to fit into your operations.

</div>
</div>

<div class="home-section">
<div>

<h2>Time to crank up the awesome</h2>

drachtio was born in carrier networks, where five nines reliability is a way of life.

Read the [getting started guide](/docs/srf/introduction), then [build a drachtio server from source](/docs/server/installing) or [grab a Docker image](https://hub.docker.com/r/drachtio/drachtio-server), and start building apps.

</div>
<div class="five-nines">99.999%</div>
</div>
