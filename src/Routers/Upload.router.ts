import { Router } from "express";
import multer from "multer";
import { getFileUrl, uploadFile } from "../Controllers/Upload.controller.js";
import { requireRole } from "../Middleware/AuthMiddleware.js";

const uploadRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB limit
  },
});

// Admin-only: the Admin Web can't use the Client Backend's /api/upload, because admin session cookies are scoped to this API.
uploadRouter.use(requireRole("admin", "super_admin"));

uploadRouter.post("/", upload.single("file"), uploadFile);
uploadRouter.get("/file", getFileUrl);

export default uploadRouter;
