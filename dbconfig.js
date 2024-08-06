import dotenv from "dotenv";
dotenv.config();
import pg from "pg";

import { Sequelize } from "sequelize";

var database = process.env.PG_DATABASE;
var username = process.env.PG_USERNAME;
var password = process.env.PG_PASSWORD;
var host = process.env.PG_HOST;
var port = process.env.PG_PORT;

export const sequelize = new Sequelize(
  database,
  username,
  password,
  {
    logging: false,
    host,
    port,
    dialect: "postgres",
    dialectModule: pg,
    sync:true,
    // dialectOptions: {
    //   ssl: {
    //     require: true,
    //     rejectUnauthorized: false,
    //   }
    // },
  }
);

try {
  await sequelize.authenticate();
  console.log("Connection has been established successfully.");
} catch (error) {
  console.error("Unable to connect to the database:", error);
}

