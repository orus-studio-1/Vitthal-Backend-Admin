import 'dotenv/config';
import cookieParser from 'cookie-parser';
import express from 'express';
import cors from 'cors';
import AuthRouter from './Routers/Auth.router.js';
import productRouter from './Routers/Product.router.js';
import orderRouter from './Routers/Order.router.js';
import vendorRouter from './Routers/Vendor.router.js';
import adminRouter from './Routers/Admin.router.js';
import { authMiddleware } from './Middleware/AuthMiddleware.js';
import { validateEnv } from './lib/env.js';
import { ensureMarketplaceSchema } from './lib/marketplace.js';

validateEnv();

const app = express();
const PORT = process.env.PORT || 9001;

//cors configuration
const allowedOrigins = ['https://vitthal-frontend.vercel.app', 'http://localhost:5173', 'http://localhost:3000'];

app.use("/", cors({
    origin: allowedOrigins,
    credentials: true,
}));

//using Middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", AuthRouter);
app.use("/api/products", authMiddleware, productRouter);
app.use("/api/orders", authMiddleware, orderRouter);
app.use("/api/vendors", authMiddleware, vendorRouter);
app.use("/api/admin", authMiddleware, adminRouter);

async function startServer() {
    try {
        await ensureMarketplaceSchema();

        app.listen(PORT, () => {
            console.log(`Admin Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to ensure marketplace schema:", error);
        process.exit(1);
    }
}

void startServer();
