import express from "express";
import dotenv from "dotenv";
dotenv.config();

import bookingRoutes from "./routes/booking.routes";
import "./workers/email.worker";
import "./workers/expiration.worker";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/booking-requests", bookingRoutes);

export default app;
