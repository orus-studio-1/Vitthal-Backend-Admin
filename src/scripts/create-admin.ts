import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { UserRole } from "../generated/prisma/enums.js";
import { getPrismaErrorMessage } from "../helpers/prismaError.helper.js";

type ScriptOptions = {
    email: string;
    password: string;
    name: string;
    role: UserRole;
};

const supportedAdminRoles = ["admin", "super_admin"] as const satisfies readonly UserRole[];

function getArgValue(flag: string): string | undefined {
    const index = process.argv.indexOf(flag);
    if (index === -1) {
        return undefined;
    }

    const value = process.argv[index + 1];

    if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${flag}.`);
    }

    return value;
}

function normalizeRole(roleInput: string): UserRole {
    const normalizedRole = roleInput.trim().toLowerCase().replace(/-/g, "_");

    if (!Object.values(UserRole).includes(normalizedRole as UserRole)) {
        throw new Error(`Invalid role. Use one of: ${Object.values(UserRole).join(", ")}.`);
    }

    if (!supportedAdminRoles.includes(normalizedRole as (typeof supportedAdminRoles)[number])) {
        throw new Error("This script only creates `admin` or `super_admin` users.");
    }

    return normalizedRole as UserRole;
}

function printUsage() {
    console.log(`Usage:
npm run admin:create -- --email you@example.com --password yourpassword --name "MTWO Admin" --role super_admin

Optional environment variables:
ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, ADMIN_ROLE`);
}

function getOptions(): ScriptOptions {
    if (process.argv.includes("--help") || process.argv.includes("-h")) {
        printUsage();
        process.exit(0);
    }

    const email = getArgValue("--email") || process.env.ADMIN_EMAIL;
    const password = getArgValue("--password") || process.env.ADMIN_PASSWORD;
    const name = getArgValue("--name") || process.env.ADMIN_NAME || "MTWO Admin";
    const roleInput = getArgValue("--role") || process.env.ADMIN_ROLE || "admin";

    if (!email || !password) {
        throw new Error(
            'Missing admin credentials. Use `npm run admin:create -- --email you@example.com --password yourpassword --name "Admin"`.'
        );
    }

    if (password.length < 6) {
        throw new Error("Admin password must be at least 6 characters long.");
    }

    return {
        email,
        password,
        name,
        role: normalizeRole(roleInput),
    };
}

async function main() {
    const { email, password, name, role } = getOptions();
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            name,
            password_hash: passwordHash,
            role,
            is_active: true,
        },
        create: {
            name,
            email,
            password_hash: passwordHash,
            role,
            is_active: true,
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            is_active: true,
            created_at: true,
        },
    });

    console.log("Admin user is ready:");
    console.log(JSON.stringify(user, null, 2));
}

main()
    .catch((error) => {
        const prismaMessage = getPrismaErrorMessage(error);
        console.error("Failed to create admin user:", prismaMessage || (error instanceof Error ? error.message : error));
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
