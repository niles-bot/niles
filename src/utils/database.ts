import { sqliteDB } from "./sqlite";

const db = new sqliteDB();
const initDb = async (): Promise<void> => await db.init();

export {
  db,
  initDb,
};
