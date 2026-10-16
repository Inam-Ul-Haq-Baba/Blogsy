import "dotenv/config";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

export async function sendPasswordResetEmail(email, resetUrl) {
    return transporter.sendMail({
        from: `"Blogsy" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Reset Your Blogsy Password",
        text: `You requested a password reset for your Blogsy account.

Open this link to choose a new password:
${resetUrl}

This link expires in 30 minutes and can only be used once.

If you did not request this reset, you can ignore this email.`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 24px; color: #1f2937;">
                <h2 style="color: #15803d;">Reset your Blogsy password</h2>

                <p>We received a request to reset your Blogsy account password.</p>

                <p>
                    <a href="${resetUrl}"
                       style="display: inline-block; background: #15803d; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none;">
                        Reset Password
                    </a>
                </p>

                <p>This link expires in 30 minutes and can only be used once.</p>

                <p>If you did not request this reset, you can safely ignore this email.</p>

                <p style="color: #6b7280; font-size: 12px;">Blogsy — Where ideas come alive</p>
            </div>
        `
    });
}


export default transporter;