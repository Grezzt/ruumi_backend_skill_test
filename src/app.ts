import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
dotenv.config();

import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";

import bookingRoutes from "./routes/booking.routes";
import "./workers/email.worker";
import "./workers/expiration.worker";

const app = express();

app.set("trust proxy", 1);

app.use(cors());

const limiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  message: {
    success: false,
    code: 429,
    type: 'ERR_TOO_MANY_REQUESTS',
    message: 'Too many requests from this IP, please try again after 2 minutes',
    data: null
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter); // Apply rate limiter to all requests
const swaggerDocument = YAML.load(path.join(__dirname, "../swagger.yaml"));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/booking-requests", bookingRoutes);

export default app;
