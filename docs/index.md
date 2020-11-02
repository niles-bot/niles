---
layout: default
title: Home
nav_order: 1
description: "Niles is a bot for displaying a simple calendar in Discord."
permalink: /
---

<img src="../assets/images/butler_hr_clear.png" width="200"/>
{: .text-center }

[Niles](https://niles.seanecoffey.com/) is a bot for displaying a simple calendar in Discord.
{: .fs-8 .text-center }

---

![example](../assets/images/discord-display.gif)
{: .text-center }

Niles interfaces with Google Calendar to display simple calendars in Discord.
{: .text-center }

---

## Using Niles

[Invite Niles to Discord](https://discord.com/oauth2/authorize?client_id=320434122344366082&scope=bot&permissions=523344){: .btn}

Visit the [Getting Started](./start) page for details on how to get started.  Don't forget to check out [customisation](./customisation) for details on how to change the way the calendar looks and works in your server.

## Help and Support

Join the [Niles Discord server](https://discord.gg/jNyntBn) if you have need help or if you have any feedback.

## Contributors

<ul class="list-style-none">
{% for contributor in sites.github.contributors %}
  <li class="d-inline-block mr-1">
     <a href="{{ contributor.html_url }}"><img src="{{ contributor.avatar_url }}" width="32" height="32" alt="{{ contributor.login }}"/></a>
  </li>
{% endfor %}
</ul>

## License

[MIT License](https://seanecoffey.mit-license.org/)

Last update: 2 Nov 2020
