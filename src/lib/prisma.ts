import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { normalizeDatabaseUrl } from "./database-url.js";

const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL);

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export { prisma };
