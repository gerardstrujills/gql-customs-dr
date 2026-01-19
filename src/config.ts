import { DataSource } from "typeorm";
import { Entry } from "./schemas/entry";
import { Product } from "./schemas/product";
import { Supplier } from "./schemas/supplier";
import { User } from "./schemas/user";
import { Withdrawal } from "./schemas/withdrawal";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: "postgresql://postgres.xoirnpngrbefbwgeditj:vzBKWqeXnm1sI9XB@aws-0-us-west-2.pooler.supabase.com:5432/postgres?pgbouncer=true",
  logging: true,
  synchronize: true,
  entities: [User, Withdrawal, Supplier, Product, Entry],
});
