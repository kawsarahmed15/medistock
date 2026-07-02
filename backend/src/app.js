import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { productsRouter } from "./routes/products.js";
import { billsRouter } from "./routes/bills.js";
import { customersRouter } from "./routes/customers.js";
import { adminRouter } from "./routes/admin.js";
import { purchasesRouter } from "./routes/purchases.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(",").map((v) => v.trim()),
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authLimiter, authRouter);
app.use("/api/products", productsRouter);
app.use("/api/bills", billsRouter);
app.use("/api/customers", customersRouter);
app.use("/api/admin", adminRouter);
app.use("/api/purchases", purchasesRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
