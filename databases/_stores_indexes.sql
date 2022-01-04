CREATE UNIQUE INDEX IF NOT EXISTS "stores_guildID"
  ON "stores" USING btree
  ("guildID" ASC NULLS LAST)