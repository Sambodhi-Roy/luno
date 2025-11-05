import express from "express";
import { router } from "./routes/v1/index.js";
import client from "@repo/db/client";
import "dotenv/config";

const app = express();
app.use(express.json());

app.use("/api/v1", router);

app.listen(process.env.PORT || 3000, () => {});
