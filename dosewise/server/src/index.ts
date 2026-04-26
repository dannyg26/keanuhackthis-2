import "dotenv/config";
import express from "express";
import cors from "cors";
import type { Request, Response, NextFunction } from "express";

import { initDb } from "./db.ts";
import authRoutes from "./routes/auth.ts";
import medicationsRoutes from "./routes/medications.ts";
import adherenceRoutes from "./routes/adherence.ts";
import riskRoutes from "./routes/risk.ts";
import billsRoutes from "./routes/bills.ts";
import couponsRoutes from "./routes/coupons.ts";
import companionRoutes from "./routes/companion.ts";
import triageRoutes from "./routes/triage.ts";
import coverageRoutes from "./routes/coverage.ts";
import placeInsightsRoutes from "./routes/place-insights.ts";
import denialExplainRoutes from "./routes/denial-explain.ts";
import denialAppealRoutes from "./routes/denial-appeal.ts";

initDb();

const app = express();

const allowedOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow no-origin (curl, mobile apps) and the configured one
      if (
        !origin ||
        origin === allowedOrigin ||
        /\.local|localhost|127\.0\.0\.1|192\.168\.|10\.|172\./.test(origin)
      ) {
        return cb(null, true);
      }
      return cb(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/medications", medicationsRoutes);
app.use("/api/adherence", adherenceRoutes);
app.use("/api/risk", riskRoutes);
app.use("/api/bills", billsRoutes);
app.use("/api/coupons", couponsRoutes);
app.use("/api/companion", companionRoutes);
app.use("/api/triage", triageRoutes);
app.use("/api/coverage", coverageRoutes);
app.use("/api/place-insights", placeInsightsRoutes);
app.use("/api/denial-explain", denialExplainRoutes);
app.use("/api/denial-appeal", denialAppealRoutes);

// Generic error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`DoseWise API listening on http://localhost:${port}`);
  if (!process.env.GROQ_API_KEY) {
    console.log(
      "  (companion using fallback replies — set GROQ_API_KEY to enable AI)",
    );
  }
});
