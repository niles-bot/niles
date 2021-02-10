---
layout: default
title: Dedicated Machine/VM
parent: Self-hosting
last_modified_date: true
nav_order: 1
---

## Self-host Guide

This page is under construction and incomplete.  Discord provides fairly self explanatory details on creating an app with a bot account (https://discord.com/developers/applications/).  You need to create an app with a bot account.  In particular the TOKEN found on the Bot page.

Please visit the [Discord support server](https://discord.gg/jNyntBn) for further help.

## General Steps

1. Clone or download the repository, `git clone https://github.com/niles-bot/Niles`

2. Install using `npm install`.

3. Create your `secrets.json` file (discussed below) inside `/config`.

4. Run `node index.js` and you should be running!


### secrets.json

The following variables are present in the secrets.json and will require an entry for the bot to function correctly, the exception being that there can be only a `service_acct_keypath` or an `oauth_acct_keypath` but at least one is required.

1. `bot_token`
2. `service_acct_keypath`
3. `oauth_acct_keypath`
4. `calendar_update_interval`
5. `admins`
6. `log_discord_channel`


1. The `bot_token` is the token required for bot to connect to your discord application service.  This can be found by creating an application at the Discord developer portal, and copying the "TOKEN" on the bot page.

2. When you create your google service account, you should be able to create a key to enable programs etc. to access your google service account.  This generates a .json key that you need to store in your Niles project.  In my case, I store it in the "config" directory, and then set my `service_acct_keypath` to "./config/Niles-XXXXXX.json"

3. In addition to the service account, Niles can use OAuth2. Google has a [guide for OAuth2](https://support.google.com/cloud/answer/6158849).  This create a .json key for your credentials that can be stored in your Niles project.  This is ususally stored in the "config" directory and then `oauth_acct_keypath` will be set to "./config/Niles-oauth-XXXXXX.json"

4. `calendar_update_interval` - the time in milliseconds between automatic updates.  Default is 300000 (5 minutes).

5. `admins` is an array for discord admin IDs. The first ID will be the "super admin" and will be notified when the bot starts. Admins will have the ability to restart shards and show how many update timers are running across all discord servers.

6. `log_discord_channel` is the CHANNEL ID where the bot logs commands, errors etc. to.  This is required or the bot will not function.  You should create a channel that Niles has write access to, copy the ID and use this.

NOTE: Discord user, server and channel ID's can be found by enabling discord developer mode by going to settings>appearance>developer mode.  You can then right click on servers, users and channels and "Copy ID".
