import type { Request, Response } from "express";
export declare const createOrder: (req: Request, res: Response) => Promise<Response>;
export declare const getOrderProductVendors: (req: Request, res: Response) => Promise<Response>;
export declare const getAllOrders: (req: Request, res: Response) => Promise<Response>;
export declare const getOrderById: (req: Request, res: Response) => Promise<Response>;
export declare const updateOrderStatus: (req: Request, res: Response) => Promise<Response>;
export declare const deleteOrder: (req: Request, res: Response) => Promise<Response>;
export declare const getOrdersByStatus: (req: Request, res: Response) => Promise<Response>;
//# sourceMappingURL=Order.controller.d.ts.map