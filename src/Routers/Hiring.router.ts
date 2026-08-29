import { Router } from "express";
import {
    getAllCandidates,
    getCandidateById,
    createCandidate,
    updateCandidate,
    verifyCandidateStatus,
    deleteCandidate,
    addCandidateDocument,
    deleteCandidateDocument,
    getAllHireRequests,
    reviewHireRequest,
    getHiringStats,
} from "../Controllers/Hiring.controller.js";

const hiringRouter = Router();

// Stats
hiringRouter.get("/stats", getHiringStats);

// Candidates CRUD & verification
hiringRouter.get("/candidates", getAllCandidates);
hiringRouter.post("/candidates", createCandidate);
hiringRouter.get("/candidates/:id", getCandidateById);
hiringRouter.patch("/candidates/:id", updateCandidate);
hiringRouter.patch("/candidates/:id/verify", verifyCandidateStatus);
hiringRouter.delete("/candidates/:id", deleteCandidate);

// Documents
hiringRouter.post("/candidates/:id/documents", addCandidateDocument);
hiringRouter.delete("/documents/:docId", deleteCandidateDocument);

// Hire requests
hiringRouter.get("/requests", getAllHireRequests);
hiringRouter.patch("/requests/:id", reviewHireRequest);

export default hiringRouter;
