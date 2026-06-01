import { Router } from "express";
import { addProductController, deleteProduct, getAllProducts, getProductById, reviewProduct, updateProduct, reviewProductImage, reviewProductSpecification, getPendingVendorProducts, reviewVendorProduct, setProductPrimaryImage, getCategories } from "../Controllers/Product.controller.js";
import { authMiddleware } from "../Middleware/AuthMiddleware.js";
const productRouter = Router();
// Secured routes for admin
productRouter.use(authMiddleware);
productRouter.get("/", getAllProducts);
productRouter.get("/pending-vendor/all", getPendingVendorProducts);
productRouter.put("/pending-vendor/:id/review", reviewVendorProduct);
productRouter.put("/image/set-primary", setProductPrimaryImage);
productRouter.get("/getCategories", getCategories);
productRouter.get("/:id", getProductById);
productRouter.put("/:id/review", reviewProduct);
productRouter.put("/image/:id/review", reviewProductImage);
productRouter.put("/specification/:id/review", reviewProductSpecification);
productRouter.post("/addProduct", addProductController);
productRouter.post("/", addProductController);
productRouter.delete("/deleteProduct", deleteProduct);
productRouter.delete("/:id", deleteProduct);
productRouter.put("/updateProduct", updateProduct);
productRouter.put("/:id", updateProduct);
export default productRouter;
//# sourceMappingURL=Product.router.js.map