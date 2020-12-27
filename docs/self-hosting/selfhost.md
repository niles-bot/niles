---
layout: default
title: Dedicated Machine/VM
parent: Self-hosting
nav_order: 1
---

## Self-host Guide

This page is under construction and incomplete.  Discord provides fairly self explanatory details on creating an app with a bot account (https://discord.com/developers/applications/).  You need to create an app with a bot account.  In particular the `bot_token` found on the "Bot" page.

Please visit the [Discord support server](https://discord.gg/jNyntBn) for further help.

## General Steps

1. Clone or download the repository, `git clone https://github.com/niles-bot/Niles`

2. Install using `npm install`.

3. Create your `secrets.json` file (discussed below) inside `/config`.  Create `guilddatabase.json` inside `/stores`, filling it with `{}` so that it is a valid JSON files.

4. Run `node index.js` and you should be running!


### secrets.json

The following variables are present in the secrets.json and will require an entry for the bot to function correctly:

1. `bot_token`
2. `service_acct_id`
3. `service_acct_keypath`
4. `support_discord_channel`
5. `current_version`
6. `calendar_update_interval`
7. `super_admin`
8. `log_discord_channel`
9. `minimumPermissions`

```
```

1. The `bot_token` is the token required for bot to connect to your discord application service.  This can be found by creating an application at the Discord developer portal, and copying the "CLIENT SECRET" on the app page.

2. The `service_acct_id` is the account ID of your Google service account allowing an application to carry out actions on google products (i.e. Calendar). You can find this at console.cloud.google.com.  Your `service_acct_id` should have the form of yourproject-123@yourproject-456.iam.gserviceaccount.com or similar.

3. When you create your google service account, you should be able to create a key to enable programs etc. to access your google service account.  This generates a .json key that you need to store in your Niles project.  In my case, I store it in the "config" directory, and then set my `service_acct_keypath` to "./config/Niles-XXXXXX.json"

4. `support_discord_channel` should really be just "support discord".  This is the guild ID of the channel that the !stats command will link to for people needing support. You may not need to add this, but it may be required to prevent errors when using commands like !stats.

5. `log_discord_channel` is the CHANNEL ID where the bot logs commands, errors etc. to.  This is required or the bot will not function.  You should create a channel that Niles has write access to, copy the ID and use this.

6. `current_version` is just an arbitrary number that is reported in !stats to keep track of which version of the bot is running.  Suggest just adding "v1".

7. `super_admin` is your discord ID.  The super admin is only used for one command at the moment, !timers, that allows only the super admin to monitor how many update timers are currently running across all discord servers.

8. `calendar_update_interval` - the time in milliseconds between automatic updates.  Default is 300000 (5 minutes).

9. `minimumPermissions` is an array of permissions that the bot considers as minimum permissions to function in a channel.  Can be useful for preventing errors due to incorrect permissions.  By default I use `"minimumPermissions": ["VIEW_CHANNEL', "SEND_MESSAGES", "MANAGE_MESSAGES", "EMBED_LINKS", "ATTACH_FILES", "READ_MESSAGE_HISTORY"]`


NOTE: Discord user, server and channel ID's can be found by enabling discord developer mode by going to settings>appearance>developer mode.  You can then right click on servers, users and channels and "Copy ID".

Last update: 8 Feb 2020
