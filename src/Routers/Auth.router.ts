import { Router } from "express";
import { getCurrentUser, loginUser, logoutUser, registerUser, requestAccountDeletion, recoverAccount } from "../Controllers/Auth.controller.js";
import { authMiddleware } from "../Middleware/AuthMiddleware.js";

const AuthRouter = Router();

// Register, Login, Logout routes
AuthRouter.post("/register", registerUser);
AuthRouter.post("/login", loginUser);
AuthRouter.post("/logout", logoutUser);
AuthRouter.get("/me", authMiddleware, getCurrentUser);
AuthRouter.post("/delete-account", authMiddleware, requestAccountDeletion);
AuthRouter.post("/recover-account", authMiddleware, recoverAccount);

export default AuthRouter;
