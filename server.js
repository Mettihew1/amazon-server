import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from './routes/authRoutes.js'
import User from "./models/UserModel.js";
import Product from './models/ProductModel.js'
import productRoutes from './routes/productRoutes.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" })); // Body size limit
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded forms

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);


app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// In your Express backend (e.g., server.js)
app.get('/api/keepalive', (req, res) => {
  res.send('Keeping MongoDB awake!'); // Just a response to confirm it worked
});

app.get('/api/products/:id', async (req, res) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ error: "Product ID required" });
    }

    // Find by either _id or another unique field like productCode
    const product = await Product.findOne({
      $or: [
        { _id: req.params.id },
        { productCode: req.params.id } // Add if you have a productCode field
      ]
    }).lean();

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Add numReviews if your frontend expects it
    product.numReviews = product.reviews?.length || 0;
    
    res.json(product);
  } catch (err) {
    console.error("Error fetching product:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().lean();
    
    // Add numReviews to each product if needed
    const enrichedProducts = products.map(p => ({
      ...p,
      numReviews: p.reviews?.length || 0
    }));
    
    res.json(enrichedProducts); // Always return array (empty if no products)
  } catch (err) {
    console.error("Failed to fetch products:", err);
    res.status(500).json({ error: "Server error" });
  }
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