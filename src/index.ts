import 'dotenv/config';
import cookieParser from 'cookie-parser';
import express from 'express';
import cors from 'cors';
import http from 'http';
import AuthRouter from './Routers/Auth.router.js';
import productRouter from './Routers/Product.router.js';
import orderRouter from './Routers/Order.router.js';
import vendorRouter from './Routers/Vendor.router.js';
import adminRouter from './Routers/Admin.router.js';
import vendorQuotationRouter from './Routers/VendorQuotation.router.js';
import clientQuotationRouter from './Routers/ClientQuotation.router.js';
import serviceRouter from './Routers/Service.router.js';
import { authMiddleware } from './Middleware/AuthMiddleware.js';
import { validateEnv } from './lib/env.js';
import { ensureMarketplaceSchema } from './lib/marketplace.js';
import { initSocket } from './lib/socket.js';
import { initNotificationEmitter } from './lib/notificationEmitter.js';

validateEnv();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 9001;

//cors configuration
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:4000',
    'https://vendor.mtwo.in',
    'https://admin.mtwo.in',
    'https://client.mtwo.in',
];

app.use("/", cors({
    origin(origin, callback) {
        if (!origin) {
            callback(null, true);
            return;
        }

        const isAllowedOrigin = allowedOrigins.includes(origin)
            || /^http:\/\/localhost:\d+$/.test(origin)
            || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin);

        callback(isAllowedOrigin ? null : new Error("Not allowed by CORS"), isAllowedOrigin);
    },
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
app.use("/api/quotations", vendorQuotationRouter);
app.use("/api/client-quotations", clientQuotationRouter);
app.use("/api/services", serviceRouter);

async function startServer() {
    try {
        await ensureMarketplaceSchema();
        initSocket(server);
        initNotificationEmitter();

        server.listen(PORT, () => {
            console.log(`Admin Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to ensure marketplace schema:", error);
        process.exit(1);
    }
}

void startServer();
