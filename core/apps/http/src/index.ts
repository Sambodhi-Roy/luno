import express from "express";
import cookieParser from "cookie-parser";
import { router } from "./routes/v1/index.js";
import client from "@repo/db/client";
import "dotenv/config";

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use("/api/v1", router);

app.listen(process.env.PORT || 3000, () => {});
