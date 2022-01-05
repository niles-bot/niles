import Keyv from "keyv";

export const db = new Keyv("sqlite://config/niles.db", { namespace: "guilds" });
