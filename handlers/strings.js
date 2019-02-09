const HELP_MESSAGE = "```\
        Niles Usage\n\
---------------------------\n\
!display             -  Display your calendar\n\
!update / !sync      -  Update the Calendar\n\
!create / !scrim     -  Create events using GCal's default interpreter - works best like !scrim xeno June 5 8pm - 9pm\n\
!delete              -  Delete an event using the form !delete Friday 8pm, ONLY works like this !delete <day> <starttime>\n\
!clean / !purge      -  Deletes messages in current channel, either !clean or !clean <number>\n\
!stats / !info       -  Display list of statistics and information about the Niles bot\n\
!invite              -  Get the invite link for Niles to join your server!\n\
!setup               -  Get details on how to setup Niles\n\
!id                  -  Set the Google calendar ID for the guild\n\
!tz                  -  Set the timezone for the guild\n\
!prefix              -  View or change the prefix for Niles\n\
!admin              -  Restrict the usage of Niles to a specific role\n\
!help                -  Display this message\n\
```\
Visit http://niles.seanecoffey.com for more info.";

const NO_CALENDAR_MESSAGE = "I can't seem to find your calendar! This is usually because you haven't invited Niles to access your calendar, run `!setup` to make sure you followed Step 1.\n\
You should also check that you have entered the correct calendar id using `!id`.\n\
\nIf you are still getting this error join the Discord support server here: https://discord.gg/jNyntBn";

const SETUP_HELP = "```\
        Niles Usage - SETUP MODE\n\
---------------------------\n\
NOTE: ALL COMMANDS BECOME AVAILABLE AFTER SETUP IS COMPLETE\n\
!setup               -  Get details on how to setup Niles for use.\n\
!prefix              -  View or change the prefix for Niles\n\
!id                  -  Set the Google calendar ID for the guild\n\
!tz                  -  Set the timezone for the guild\n\
!adminrole           -  Restrict the usage of Niles to a specific role\n\
!help                -  Display this message\n\
```\n\
Visit http://niles.seanecoffey.com/setup for more info.";

const SETUP_MESSAGE = "\
Hi! Lets get me setup for use in this Discord. The steps are outlined below, but for a detailed setup guide, visit http://niles.seanecoffey.com/setup \n\
\n1. Invite `niles-291@niles-169605.iam.gserviceaccount.com` to \'Make changes to events\' under the Permission Settings on the Google Calendar you want to use with Niles\n\
2. Enter the Calendar ID of the calendar to Discord using the `!id` command, i.e. `!id 123abc@123abc.com`\n\
3. Enter the timezone you want to use in Discord with the `!tz` command, i.e. `!tz gmt+10:00`, (Note: Must be formatted like this, with all FOUR DIGITS in the hour offset!)\n\
\n Niles should now be able to sync with your Google calendar and interact with on you on Discord, try `!display` to get started!";

const RESTRICT_ROLE_MESSAGE = "\
You can restrict who can control Niles and the associated Google Calendar with roles. \n\
Niles will only allow one role to be used, and it must have a unique name. \n\
The person assigning the restriction must have the role being assigned. \n\
i.e. Create a role called *Scheduler*, and then tell Niles to only allow people with that role using `!roles Scheduler` (case sensitive)\n\
**Warning - Experimental Feature - Please go to the Niles discord server and post if you have any issues with this feature**";

module.exports = {
  HELP_MESSAGE,
  NO_CALENDAR_MESSAGE,
  SETUP_MESSAGE,
  SETUP_HELP,
  RESTRICT_ROLE_MESSAGE
};
