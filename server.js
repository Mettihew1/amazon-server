import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from './routes/auth.js'
import User from "./models/User.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" })); // Body size limit
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded forms

app.use('/api/auth', authRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// In your Express backend (e.g., server.js)
app.get('/api/keepalive', (req, res) => {
  res.send('Keeping MongoDB awake!'); // Just a response to confirm it worked
});

// In your Express backend (e.g., server.js)
app.get('/', async(req, res) => {
  console.log("checkpoint")
  const log = await User.find()
  console.log(log);
  res.end()
});


// Enhanced MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");
    
    // Connection event listeners
    mongoose.connection.on("connected", () => {
      console.log("Mongoose connected to DB");
    });
    
    mongoose.connection.on("error", (err) => {
      console.error("Mongoose connection error:", err);
    });
    
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
};

// Health Check Route
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    dbState: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"
  });
});

// Centralized Error Handling
app.use((err, req, res, next) => {
  console.error("🔥 Error:", err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || "Internal Server Error",
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    }
  });
});

// Server Startup
const startServer = async () => {
  try {
    await connectDB();
    app.listen(process.env.PORT || 5000, () => {
      console.log(`🚀 Server running on port ${process.env.PORT || 5000}`);
      console.log(`📡 Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (err) {
    console.error("💥 Server startup failed:", err);
    process.exit(1);
  }
};

startServer();

// Graceful Shutdown
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("⏏️ MongoDB disconnected through app termination");
  process.exit(0);
});