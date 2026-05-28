import * as runtime from "@prisma/client/runtime/client";
import * as $Class from "./internal/class.js";
import * as Prisma from "./internal/prismaNamespace.js";
export * as $Enums from './enums.js';
export * from "./enums.js";
/**
 * ## Prisma Client
 *
 * Type-safe database client for TypeScript
 * @example
 * ```
 * const prisma = new PrismaClient({
 *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
 * })
 * // Fetch zero or more Users
 * const users = await prisma.user.findMany()
 * ```
 *
 * Read more in our [docs](https://pris.ly/d/client).
 */
export declare const PrismaClient: $Class.PrismaClientConstructor;
export type PrismaClient<LogOpts extends Prisma.LogLevel = never, OmitOpts extends Prisma.PrismaClientOptions["omit"] = Prisma.PrismaClientOptions["omit"], ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = $Class.PrismaClient<LogOpts, OmitOpts, ExtArgs>;
export { Prisma };
/**
 * Model User
 *
 */
export type User = Prisma.UserModel;
/**
 * Model Product
 *
 */
export type Product = Prisma.ProductModel;
/**
 * Model ProductImage
 *
 */
export type ProductImage = Prisma.ProductImageModel;
/**
 * Model Vendor
 *
 */
export type Vendor = Prisma.VendorModel;
/**
 * Model Order
 *
 */
export type Order = Prisma.OrderModel;
/**
 * Model VendorProduct
 *
 */
export type VendorProduct = Prisma.VendorProductModel;
/**
 * Model Cart
 *
 */
export type Cart = Prisma.CartModel;
/**
 * Model QuotationRequest
 *
 */
export type QuotationRequest = Prisma.QuotationRequestModel;
/**
 * Model QuotationMessage
 *
 */
export type QuotationMessage = Prisma.QuotationMessageModel;
//# sourceMappingURL=client.d.ts.map