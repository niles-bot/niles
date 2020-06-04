---
layout: default
---

## Self-hosting on Glitch [ UNOFFICIAL ]

This page is under construction, unofficial and incomplete.

For help specifically with Glitch contact @blabdude on the support server for further help.

## Setup Instructions

1. Remix or preview the code on Glitch (maintained by [@mchangrh](https://github.com/mchangrh) / blabdude#9793 )
2. Create your `secrets.json` file inside `/config` - instructions on [selfhost](selfhost)

### !!! Special notes for glitch !!!
in `package.json`, it will prompt you to "Add Package". Do not add any of these packages as they will break Niles. This will produce the error `bot.client.channels.get is not a function`.

To mitigate this issue, copy the `"dependencies": {}` section from [Github](https://github.com/seanecoffey/Niles/blob/master/package.json#L11)

<!-- Remix Button -->
<a href="https://glitch.com/edit/#!/remix/niles-template">
  <img src="https://cdn.glitch.com/2bdfb3f8-05ef-4035-a06e-2043962a3a13%2Fremix%402x.png?1513093958726" alt="remix this" height="33">
</a>
<!-- View Source Button -->
<a href="https://glitch.com/edit/#!/niles-template">
  <img src="https://cdn.glitch.com/2bdfb3f8-05ef-4035-a06e-2043962a3a13%2Fview-source%402x.png?1513093958802" alt="view source" height="33">
</a>

### Changes from upstream
<details>
  <summary>Click to expand</summary>

  1. created `stores/guilddatabase.json` & `stores/users.json`
  2. replaced `node-google-calendar` with `@mchangrh/node-google-calendar`
     * to patch `HttpRequest.js` (impossible on glitch)
     * Source code on GitHub: https://github.com/mchangrh/node-google-calendar
  3. added start script as per: https://glitch.com/help/failstart/
</details>

Last update: 2 June 2020
