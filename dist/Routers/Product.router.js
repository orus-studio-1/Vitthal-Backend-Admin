import { Router } from "express";
import multer from "multer";
import { addProductController, deleteProduct, getAllProducts, getProductById, reviewProduct, updateProduct, reviewProductImage, reviewProductSpecification, getPendingVendorProducts, reviewVendorProduct, setProductPrimaryImage, getCategories, addCategoryController, updateCategoryController, deleteCategoryController, uploadProductImagesController, getProductTypes, getPendingPriceChanges, reviewPendingPriceChange, getPendingVariants, reviewProductVariant } from "../Controllers/Product.controller.js";
import { authMiddleware } from "../Middleware/AuthMiddleware.js";
const productRouter = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB limit
    },
});
// Secured routes for admin
productRouter.use(authMiddleware);
productRouter.get("/", getAllProducts);
productRouter.get("/getProductTypes", getProductTypes);
productRouter.get("/pending-vendor/all", getPendingVendorProducts);
productRouter.put("/pending-vendor/:id/review", reviewVendorProduct);
productRouter.get("/pending-price/all", getPendingPriceChanges);
productRouter.put("/pending-price/:id/review", reviewPendingPriceChange);
productRouter.get("/pending-variants/all", getPendingVariants);
productRouter.put("/pending-variants/:id/review", reviewProductVariant);
productRouter.put("/image/set-primary", setProductPrimaryImage);
productRouter.get("/getCategories", getCategories);
productRouter.post("/categories/add", upload.single("image"), addCategoryController);
productRouter.put("/categories/:id", upload.single("image"), updateCategoryController);
productRouter.delete("/categories/:id", deleteCategoryController);
productRouter.get("/:id", getProductById);
productRouter.put("/:id/review", reviewProduct);
productRouter.put("/image/:id/review", reviewProductImage);
productRouter.put("/specification/:id/review", reviewProductSpecification);
productRouter.post("/addProduct", addProductController);
productRouter.post("/", addProductController);
productRouter.post("/uploadProductImages", upload.array("images", 5), uploadProductImagesController);
productRouter.delete("/deleteProduct", deleteProduct);
productRouter.delete("/:id", deleteProduct);
productRouter.put("/updateProduct", updateProduct);
productRouter.put("/:id", updateProduct);
export default productRouter;
//# sourceMappingURL=Product.router.js.map