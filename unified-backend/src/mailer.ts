import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

/**
 * Shared Nodemailer transporter.
 * Replaces the Kafka "send-mail" topic that was used across services.
 * Call sendMail().catch(err => ...) for fire-and-forget usage.
 */
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

export const sendMail = async (options: MailOptions): Promise<void> => {
  await transporter.sendMail({
    from: `HireHeaven <${process.env.SMTP_USER}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
  console.log(`📧 Mail sent to ${options.to}`);
};
