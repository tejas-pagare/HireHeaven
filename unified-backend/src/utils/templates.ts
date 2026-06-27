/**
 * Shared email HTML templates.
 * Consolidated from auth/src/templete.ts and job/src/tempelete.ts
 */

export const forgotPasswordTemplate = (resetLink: string): string => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
  <h2 style="color: #4F46E5;">Reset Your Password</h2>
  <p>You requested a password reset for your HireHeaven account.</p>
  <p>Click the button below to reset your password. This link expires in <strong>15 minutes</strong>.</p>
  <a href="${resetLink}"
     style="display: inline-block; margin-top: 16px; padding: 12px 28px;
            background: #4F46E5; color: white; text-decoration: none;
            border-radius: 6px; font-weight: bold;">
    Reset Password
  </a>
  <p style="margin-top: 20px; color: #888; font-size: 13px;">
    If you did not request this, please ignore this email.
  </p>
</div>
`;

export const applicationStatusUpdateTemplate = (jobTitle: string): string => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
  <h2 style="color: #4F46E5;">Application Status Updated</h2>
  <p>Your application for <strong>${jobTitle}</strong> has been updated.</p>
  <p>Log in to your HireHeaven account to view the latest status.</p>
  <a href="${process.env.Frontend_Url}/applications"
     style="display: inline-block; margin-top: 16px; padding: 12px 28px;
            background: #4F46E5; color: white; text-decoration: none;
            border-radius: 6px; font-weight: bold;">
    View Application
  </a>
</div>
`;

export const chatNotificationTemplate = (
  senderName: string,
  jobTitle: string,
  messageContent: string,
  conversationId: number
): string => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
  <h2 style="color: #4F46E5;">You have a new message!</h2>
  <p><strong>${senderName}</strong> sent you a message regarding <strong>${jobTitle}</strong>:</p>
  <blockquote style="border-left: 3px solid #4F46E5; padding-left: 12px; color: #555; margin: 16px 0;">
    "${messageContent.length > 200 ? messageContent.substring(0, 200) + "..." : messageContent}"
  </blockquote>
  <a href="${process.env.FRONTEND_URL}/chat/${conversationId}"
     style="display: inline-block; margin-top: 16px; padding: 12px 28px;
            background: #4F46E5; color: white; text-decoration: none;
            border-radius: 6px; font-weight: bold;">
    Open Chat
  </a>
</div>
`;
