// External Dependencies
import * as mongoDB from "mongodb";
import { mongo_url } from "~/../config/secrets.json";

// Global Variables
export const collections: { users?: mongoDB.Collection } = {}

// Initialize Connection
export async function connectToDatabase () {
  const client: mongoDB.MongoClient = new mongoDB.MongoClient(mongo_url);

  await client.connect();

  const db: mongoDB.Db = client.db("crios");
  const userCollection: mongoDB.Collection = db.collection("users");
  collections.users = userCollection;

  // eslint-disable-next-line no-console
  console.log(`Successfully connected to database: ${db.databaseName}`);
}