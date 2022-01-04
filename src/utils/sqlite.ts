import Sqlite3 from "better-sqlite3";
import fs from "fs";
import debugModule from "debug"
const debug = debugModule("niles:db")

export class sqliteDB {
  private db: Sqlite3.Database;

  constructor() {}

  // eslint-disable-next-line require-await
  async prepare(type: "get" | "all" | "run", query: string, params: any[] = []): Promise < any[] > {
    // debug.debug(`prepare: type: ${type}, query: ${query}, params: ${params}`);
    const preparedQuery = this.db.prepare(query);

    switch (type) {
      case "get": {
        return preparedQuery.get(...params);
      }
      case "all": {
        return preparedQuery.all(...params);
      }
      case "run": {
        preparedQuery.run(...params);
        break;
      }
    }
  }

  async init(): Promise < void > {
    this.db = new Sqlite3("./databases/stores.db");

    this.db.exec(fs.readFileSync("./databases/_stores.db.sql").toString());

    // Upgrade database if required
    sqliteDB.upgradeDB(this.db);

    // Enable WAL mode checkpoint
    this.db.exec("PRAGMA journal_mode=WAL;");
    this.db.exec("PRAGMA wal_autocheckpoint=1;");

    // Enable Memory-Mapped IO
    this.db.exec("pragma mmap_size= 500000000;");
  }

  private static upgradeDB(db: Sqlite3.Database) {
    const schemaFolder = "./databases"
    const versionCodeInfo = db.prepare("SELECT value FROM config WHERE key = ?").get("version");
    let versionCode = versionCodeInfo ? versionCodeInfo.value : 0;

    let path = `${schemaFolder}/_upgrade_stores_${(parseInt(versionCode) + 1)}.sql`;
    debug(`db update: trying ${path}`);
    while (fs.existsSync(path)) {
      debug(`db update: updating ${path}`);
      db.exec(fs.readFileSync(path).toString());

      versionCode = db.prepare("SELECT value FROM config WHERE key = ?").get("version").value;
      path = `${schemaFolder}/_upgrade_stores_${(parseInt(versionCode) + 1)}.sql`;
      debug(`db update: trying ${path}`);
    }
    debug(`db update: no file ${path}`);
  }
}
