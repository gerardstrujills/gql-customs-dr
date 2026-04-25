import { DataSource } from "typeorm";
import { Entry } from "./schemas/entry";
import { Product } from "./schemas/product";
import { Supplier } from "./schemas/supplier";
import { User } from "./schemas/user";
import { Withdrawal } from "./schemas/withdrawal";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: "postgresql://postgres.lgxkrupmatznczeywwkm:N3EUc5R7REp3IPRm@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
  logging: true,
  synchronize: true,
  entities: [User, Withdrawal, Supplier, Product, Entry],
});
