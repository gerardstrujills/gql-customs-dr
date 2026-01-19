import { ApolloServer } from "apollo-server-express";
import cors from "cors";
import express from "express";
import session from "express-session";
import Redis from "ioredis";
import "reflect-metadata";
import { buildSchema } from "type-graphql";
import reniecRoute from "./api/reniec";
import sunatRoute from "./api/sunat";
import { AppDataSource } from "./config";
import { COOKIE_NAME } from "./constants";
import { EntryResolver } from "./resolvers/entry.resolver";
import { IncomeResolver } from "./resolvers/income.resolver";
import { ProductResolver } from "./resolvers/product.resolver";
import { StockResolver } from "./resolvers/stock.resolver";
import { SupplierResolver } from "./resolvers/supplier.resolver";
import { UserResolver } from "./resolvers/user.resolver";
import { WithdrawalResolver } from "./resolvers/withdrawal";
import { WithdrawalKardexResolver } from "./resolvers/withdrawal.resolver";

const main = async () => {
  await AppDataSource.initialize();

  const app = express();

  const RedisStore = require("connect-redis").default;

  const redis = new Redis({
    host: "redis-16496.c278.us-east-1-4.ec2.redns.redis-cloud.com",
    port: 16496,
    password: "5SSp6uL3U1I6sTyawOCxg63CxmBWvuJo",
  });

  // Verificar conexión Redis
  redis.on("connect", () => console.log("✅ Conectado a Redis"));
  redis.on("error", (err) => console.log("❌ Error Redis:", err));

  app.set("trust proxy", 1);

  // CORS mejorado
  app.use(
    cors({
      origin: "https://dr-servicios-generales.netlify.app",
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    }),
  );

  // Middleware para debug - CORREGIDO (sin 'res' no usado)
  app.use((req, _, next) => {
    console.log("🔍 Headers recibidos:", req.headers.origin);
    console.log("🍪 Cookies recibidas:", req.headers.cookie);
    console.log("📝 Método:", req.method);
    next();
  });

  // Configuración de sesión FIX para producción
  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({
        client: redis,
        disableTTL: true,
        disableTouch: true,
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
        httpOnly: true,
        sameSite: "none", // ← CRÍTICO para cross-site
        secure: true, // ← CRÍTICO para HTTPS
        // NO uses domain por ahora
      },
      saveUninitialized: false,
      secret: "pass",
      resave: false,
    }),
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [
        UserResolver,
        ProductResolver,
        EntryResolver,
        SupplierResolver,
        WithdrawalResolver,
        WithdrawalKardexResolver,
        StockResolver,
        IncomeResolver,
      ],
      validate: false,
    }),
    context: ({ req, res }) => ({
      req,
      res,
    }),
  });

  await apolloServer.start();

  apolloServer.applyMiddleware({
    app: app as any,
    cors: {
      credentials: true,
      origin: "https://dr-servicios-generales.netlify.app",
    },
  });

  reniecRoute(app);
  sunatRoute(app);

  // ✅ PUERTO CORRECTO - Convertir a número
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 GraphQL: http://0.0.0.0:${PORT}/graphql`);
  });
};

main().catch((e) => console.log(e));
