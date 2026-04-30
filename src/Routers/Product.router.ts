import { Router } from "express";
import {
    addProductController,
    deleteProduct,
    getAllProducts,
    getProductById,
    reviewProduct,
    updateProduct
} from "../Controllers/Product.controller.js";
import { authMiddleware } from "../Middleware/AuthMiddleware.js";

const productRouter = Router();

// Secured routes for admin
productRouter.use(authMiddleware);

productRouter.get("/", getAllProducts);
productRouter.get("/:id", getProductById);
productRouter.put("/:id/review", reviewProduct);
productRouter.post("/addProduct", addProductController);
productRouter.post("/", addProductController);
productRouter.delete("/deleteProduct", deleteProduct);
productRouter.delete("/:id", deleteProduct);
productRouter.put("/updateProduct", updateProduct);
productRouter.put("/:id", updateProduct);

export default productRouter;
