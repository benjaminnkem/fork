import mongoose, { type Connection, type Model } from "mongoose";
import { MONGO_SCHEMAS, type PersistenceCollection } from "./schemas.js";

export type PersistenceModels = {
  [K in PersistenceCollection]: Model<object>;
};

export async function connectMongo(uri: string, dbName: string): Promise<Connection> {
  const connection = await mongoose.createConnection(uri, {
    dbName,
  }).asPromise();
  return connection;
}

export function createPersistenceModels(connection: Connection): PersistenceModels {
  const models = {} as PersistenceModels;
  for (const [name, schema] of Object.entries(MONGO_SCHEMAS)) {
    const key = name as PersistenceCollection;
    models[key] = (connection.models[name] ?? connection.model(name, schema)) as Model<object>;
  }
  return models;
}

export async function ensureMongoIndexes(connection: Connection): Promise<void> {
  const models = createPersistenceModels(connection);
  for (const model of Object.values(models)) {
    await model.createIndexes();
  }
}

export async function pingMongo(connection: Connection): Promise<boolean> {
  if (connection.readyState !== 1) return false;
  const result = await connection.db?.admin().command({ ping: 1 });
  return result?.ok === 1;
}

export async function disconnectMongo(connection: Connection): Promise<void> {
  await connection.close();
}
