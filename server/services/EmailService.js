const path = require("path");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "wastezeroofficial@gmail.com",
    pass: "vgzk ugdr wbms bzdn",
  },
});

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildEmailShell = ({ title, contentHtml, footerText }) => `
  <div style="font-family: Arial, sans-serif; background-color: #f6f6f6; padding: 20px;">
    <div style="max-width: 560px; margin: auto; background-color: #ffffff; padding: 24px; border-radius: 12px;">
      
      <!-- Header without icon -->
      <div style="margin-bottom: 18px;">
        <div style="margin: 0; color: #0f172a; font-size: 22px; font-weight: 800;">WasteZero</div>
        <div style="margin-top: 2px; color: #334155; font-size: 14px; font-weight: 600;">
          ${escapeHtml(title)}
        </div>
      </div>

      ${contentHtml}

      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 16px;" />
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        ${escapeHtml(footerText)}
      </p>
    </div>
  </div>
`;

async function sendVerificationEmail(userEmail) {
  const verificationCode = Math.floor(100000 + Math.random() * 900000);

  await transporter.sendMail({
    from: '"WasteZero" <wastezeroofficial@gmail.com>',
    to: userEmail,
    subject: "Your Verification Code",
    text: `Your verification code is ${verificationCode}`,
    html: buildEmailShell({
      title: "Your Verification Code",
      contentHtml: `
        <p style="color: #555; font-size: 14px; line-height: 1.7; margin: 0 0 10px;">Hello,</p>
        <p style="color: #555; font-size: 14px; line-height: 1.7; margin: 0 0 14px;">
          Use the verification code below to complete your request.
        </p>
        <div style="text-align: center; margin: 30px 0; padding: 18px; border-radius: 14px; background: #f8fafc; border: 1px solid #e2e8f0;">
          <div style="margin: 0; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #0f172a;">
            ${verificationCode}
          </div>
        </div>
        <p style="color: #555; font-size: 14px; line-height: 1.7; margin: 0 0 10px;">
          This code is valid for <strong>10 minutes</strong>.
        </p>
        <p style="color: #64748b; font-size: 12px; line-height: 1.7; margin: 0;">
          Do not share this code with anyone. WasteZero will never ask for your verification code.
        </p>
      `,
      footerText: "If you did not request this, you can safely ignore this email.",
    }),
  });

  console.log(`Verification code ${verificationCode} sent to ${userEmail}`);
  return verificationCode;
}

function buildEmailHtml(title, text) {
  const safeTitle = title || "WasteZero";
  const bodyHtml = String(text || "")
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return `<div style="height: 12px;"></div>`;
      }
      return `<p style="color: #555; font-size: 14px; line-height: 1.7; margin: 0 0 10px;">${escapeHtml(trimmed)}</p>`;
    })
    .join("");

  return buildEmailShell({
    title: safeTitle,
    contentHtml: bodyHtml,
    footerText: "This email was sent by WasteZero admin tools.",
  });
}

async function sendPlainEmail({ to, subject, text }) {
  await transporter.sendMail({
    from: '"WasteZero" <wastezeroofficial@gmail.com>',
    to,
    subject,
    text,
    html: buildEmailHtml(subject, text),
  });
}

module.exports = { sendVerificationEmail, sendPlainEmail };