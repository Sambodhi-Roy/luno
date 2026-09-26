import * as dotenv from "dotenv";
dotenv.config();

import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { router } from "./routes/v1/index.js";

const app = express();
// The web app runs on its own port, so the browser needs CORS with credentials for the auth cookie
app.use(
  cors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1", router);

const PORT = Number(process.env.PORT ?? 3001);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
