import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailPayload {
    to: string | string[];
    subject: string;
    htmlContent: string;
    textContent?: string;
    attachments?: Array<{
        filename: string;
        content: Buffer;
    }>;
    replyTo?: string;
}

export interface EmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
    try {
        if (!process.env.RESEND_API_KEY) {
            console.error("RESEND_API_KEY environment variable is missing");
            return {
                success: false,
                error: "RESEND_API_KEY environment variable is missing",
            };
        }

        const fromAddress =
            process.env.MAIL_FROM ||
            process.env.EMAIL_FROM ||
            "onboarding@resend.dev";

        const sendOptions: any = {
            from: fromAddress,
            to: payload.to,
            subject: payload.subject,
            html: payload.htmlContent,
        };

        if (payload.textContent) {
            sendOptions.text = payload.textContent;
        }
        if (payload.replyTo || process.env.EMAIL_REPLY_TO) {
            sendOptions.replyTo = payload.replyTo || process.env.EMAIL_REPLY_TO;
        }
        if (payload.attachments && payload.attachments.length > 0) {
            sendOptions.attachments = payload.attachments;
        }

        const { data, error } = await resend.emails.send(sendOptions);

        if (error) {
            console.error(`Failed to send email to ${payload.to}: ${error.message}`);
            return {
                success: false,
                error: error.message,
            };
        }

        console.log(`Email sent successfully to ${payload.to}. Message ID: ${data?.id}`);
        return {
            success: true,
            messageId: data?.id,
        };
    } catch (err: any) {
        console.error(`Unexpected error sending email to ${payload.to}:`, err);
        return {
            success: false,
            error: err.message || "Unknown email error",
        };
    }
}

export interface SendReconsiderationInput {
    vendorEmail: string;
    vendorName: string;
    companyName: string;
    notes: string;
}

export async function sendVendorReconsiderationEmail({
    vendorEmail,
    vendorName,
    companyName,
    notes,
}: SendReconsiderationInput) {
    const portalUrl = process.env.VENDOR_PORTAL_URL || "https://vendor.mtwo.in/login";

    return await sendEmail({
        to: vendorEmail,
        subject: `Action Required: Reconsideration of your Vendor Application - ${companyName}`,
        htmlContent: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
                <!-- Header -->
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 24px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <img src="https://res.cloudinary.com/deudvpcgx/image/upload/v1779186769/favicon_somltc.jpg" alt="Logo" style="height: 40px; width: 40px; border-radius: 8px; object-fit: cover;" />
                        <span style="font-size: 18px; font-weight: 700; color: #0f4c81; letter-spacing: 0.5px;">MTWO GROUPS</span>
                    </div>
                </div>

                <!-- Content -->
                <h2 style="font-size: 20px; font-weight: 700; color: #0f4c81; margin-top: 0; margin-bottom: 12px;">
                    Vendor Application Update
                </h2>
                <p style="font-size: 14px; color: #475569; margin-top: 0; margin-bottom: 20px; line-height: 1.6;">
                    Dear <strong>${vendorName}</strong>,
                </p>
                <p style="font-size: 14px; color: #475569; margin-top: 0; margin-bottom: 20px; line-height: 1.6;">
                    Thank you for applying to be a partner on the MTWO Groups B2B marketplace. Upon reviewing your registration details for <strong>${companyName}</strong>, our team has identified some details that need correction or reconsideration before we can finalize your onboarding.
                </p>

                <!-- Reviewer Notes -->
                <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
                    <h3 style="font-size: 14px; font-weight: 700; color: #b45309; margin-top: 0; margin-bottom: 8px;">
                        Notes from the Administrator:
                    </h3>
                    <p style="font-size: 13px; color: #78350f; margin: 0; line-height: 1.6; white-space: pre-wrap;">${notes}</p>
                </div>

                <!-- Action instruction -->
                <p style="font-size: 14px; color: #475569; margin-top: 0; margin-bottom: 24px; line-height: 1.6;">
                    Please log into your vendor dashboard using the link below, review the note above, update your business registration details/documents accordingly, and resubmit your profile.
                </p>

                <div style="text-align: center; margin-bottom: 24px;">
                    <a href="${portalUrl}" style="display: inline-block; padding: 12px 28px; background-color: #0f4c81; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 8px; transition: background-color 0.2s;">
                        Log In and Update Profile
                    </a>
                </div>

                <!-- Footer disclaimer -->
                <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; text-align: center;">
                    <p style="font-size: 11px; color: #94a3b8; margin: 0; line-height: 1.5;">
                        This is an automated operational transmission from MTWO Groups Onboarding team.
                    </p>
                </div>
            </div>
        `,
    });
}
