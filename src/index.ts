import express from "express";
import dotenv from "dotenv";
import bookingRoutes from "./routes/booking.routes";
import "./workers/email.worker";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/booking-requests", bookingRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
