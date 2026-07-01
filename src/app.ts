import express from "express";
import dotenv from "dotenv";
dotenv.config();

import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";

import bookingRoutes from "./routes/booking.routes";
import "./workers/email.worker";
import "./workers/expiration.worker";

const app = express();

const swaggerDocument = YAML.load(path.join(__dirname, "../swagger.yaml"));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/booking-requests", bookingRoutes);

export default app;
