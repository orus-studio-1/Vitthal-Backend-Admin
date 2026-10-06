// routes/contactQueries.ts
import { Router } from "express";
import { getClientQueries, updateClientQuery } from "../Controllers/ContactQueries.controller.js";

const contactQueriesRouter = Router();

contactQueriesRouter.get("/queries", getClientQueries);

contactQueriesRouter.patch("/queries/:id", updateClientQuery);

export default contactQueriesRouter;