import { Router } from "express";
import { getCurrentUser, loginUser, logoutUser, registerUser } from "../Controllers/Auth.controller.js";
import { authMiddleware } from "../Middleware/AuthMiddleware.js";
const AuthRouter = Router();
// Register, Login, Logout routes
AuthRouter.post("/register", registerUser);
AuthRouter.post("/login", loginUser);
AuthRouter.post("/logout", logoutUser);
AuthRouter.get("/me", authMiddleware, getCurrentUser);
export default AuthRouter;
//# sourceMappingURL=Auth.router.js.map