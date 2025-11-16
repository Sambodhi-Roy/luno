import * as dotenv from "dotenv";
dotenv.config();

import express from "express";
import cookieParser from "cookie-parser";
import { router } from "./routes/v1/index.js";
import client from "@repo/db/client";

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1", router);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
