import express from "express";
import cookieParser from "cookie-parser";
import { router } from "./routes/v1/index.js";
import client from "@repo/db/client";
import * as dotenv from "dotenv";

const app = express();

dotenv.config();
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1", router);

app.listen(3000, () => {
  console.log(process.env.JWT_SECRET);

  console.log("Server running on port 3000");
});
