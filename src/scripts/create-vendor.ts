import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";

type ScriptOptions = {
    email: string;
    password?: string | undefined;
    name: string;
    companyName: string;
    phone?: string | undefined;
};

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

function printUsage() {
    console.log(`Usage:
npm run vendor:create -- --email you@gmail.com --password yourpassword --name "Vendor Name" --company "Company Name" [--phone "1234567890"]
`);
}

function getOptions(): ScriptOptions {
    if (process.argv.includes("--help") || process.argv.includes("-h")) {
        printUsage();
        process.exit(0);
    }

    const args = process.argv.slice(2);
    const hasFlags = args.some(arg => arg.startsWith("--"));

    let email: string | undefined;
    let password: string | undefined;
    let name: string | undefined;
    let companyName: string | undefined;
    let phone: string | undefined;

    if (hasFlags) {
        email = getArgValue("--email");
        password = getArgValue("--password");
        name = getArgValue("--name");
        companyName = getArgValue("--company");
        phone = getArgValue("--phone");
    } else {
        // Fallback to positional arguments: email, password, name, company, phone
        email = args[0];
        password = args[1];
        name = args[2];
        companyName = args[3];
        phone = args[4];
    }

    if (!email || !name || !companyName) {
        printUsage();
        throw new Error('Missing required arguments. Provide flags (--email, --password, --name, --company) or positional values (email password name company [phone]).');
    }

    return {
        email,
        password,
        name,
        companyName,
        phone,
    };
}

async function main() {
    const { email, password, name, companyName, phone } = getOptions();
    const cleanEmail = email.trim().toLowerCase();
    const passwordToHash = password || "Vendor@123";
    const hashedPassword = await bcrypt.hash(passwordToHash, 10);

    const user = await prisma.user.upsert({
        where: { email: cleanEmail },
        update: {
            name: name.trim(),
            password_hash: hashedPassword,
            role: "vendor",
            is_active: true,
            is_verified: true,
        },
        create: {
            name: name.trim(),
            email: cleanEmail,
            password_hash: hashedPassword,
            role: "vendor",
            is_active: true,
            is_verified: true,
        },
    });

    const appNumber = `APP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const vendor = await prisma.vendor.upsert({
        where: { user_id: user.id },
        update: {
            company_name: companyName.trim(),
            phone: phone ? phone.trim() : null,
            is_active: true,
            is_blocked: false,
            approval_status: "approved",
            is_approved: true,
            approval_notes: "Created via CLI script",
        },
        create: {
            user_id: user.id,
            company_name: companyName.trim(),
            phone: phone ? phone.trim() : null,
            is_active: true,
            is_blocked: false,
            approval_status: "approved",
            is_approved: true,
            application_number: appNumber,
            approval_notes: "Created via CLI script",
        },
    });

    console.log("Vendor user created/updated successfully:");
    console.log("User:", {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_verified: user.is_verified,
    });
    console.log("Vendor Details:", {
        id: vendor.id,
        company_name: vendor.company_name,
        application_number: vendor.application_number,
        approval_status: vendor.approval_status,
        is_approved: vendor.is_approved,
    });
}

main()
    .catch((error) => {
        console.error("Failed to create vendor user:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
