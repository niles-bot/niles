import { db } from "~/src/utils/database";
import Debug from "debug";
const debug = Debug("niles:guilds");

type GuildValue = string | boolean | number;
type GuildKeys = keyof typeof updateSettings | keyof typeof discordSettings | keyof typeof calendarSettings;
type GuildNamespace = "update" | "discord" | "calendar" | "display";

const updateSettings = {
  channel: "0",
  success: 0,
  attempt: 0
};

const discordSettings = {
  admin: null as string,
  lng: "en",
  debug: false,
};

const calendarSettings = {
  id: null as string,
  timezone: "Europe/UTC",
  days: 7,
  token: null as string,
};

const displaySettings = {
  name: "CALENDAR",
  title_link: null as string,
  footer_help: true,
  footer_tz: true,
  time_24h: false,
  title: true,
  title_length: 40,
  desc: true,
  desc_length: 40,
  event_end: true,
  event_past: false,
  day_empty: false,
  inline: true,
  url: false,
};

export const defaultSettings = {
  update: updateSettings,
  discord: discordSettings,
  calendar: calendarSettings,
  display: displaySettings
};

export class NilesGuild {
  id: string;

  constructor(guildID: string) {
    this.id = guildID;
  }
  get = async (namespace: GuildNamespace): Promise<Record<GuildKeys, GuildValue>> => {
    debug(`get | ${this.id} | ${namespace}`);
    return await db.get(`v1_${this.id}_${namespace}`) || defaultSettings[namespace];
  };
  getValue = async (namespace: GuildNamespace, key: GuildKeys): Promise<GuildValue> => {
    debug(`get | ${this.id} | ${namespace} | ${key}`);
    const options = await this.get(namespace);
    return options[key];
  };
  set = async (namespace: GuildNamespace, key: GuildKeys, value: GuildValue): Promise<void> => {
    debug(`set | ${this.id} | ${namespace} | ${key} | ${value}`);
    const options = await this.get(namespace);
    options[key] = value;
    await db.set(`v1_${this.id}_${namespace}`, options);
  };
}
