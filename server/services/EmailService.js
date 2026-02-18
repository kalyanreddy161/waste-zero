const nodemailer = require("nodemailer");

// 1. Create the transporter (The connection to your email provider)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'wastezeroofficial@gmail.com',
    pass: 'vgzk ugdr wbms bzdn' 
  }
});

// 2. Function to generate and send the code
async function sendVerificationEmail(userEmail) {
  const verificationCode = Math.floor(100000 + Math.random() * 900000);

  await transporter.sendMail({
    from: '"WasteZero" <wastezeroofficial@gmail.com>',
    to: userEmail,
    subject: 'Your Verification Code',
    text: `Your verification code is ${verificationCode}`,
    html: `<div style="font-family: Arial, sans-serif; background-color: #f6f6f6; padding: 20px;">
  <div style="max-width: 480px; margin: auto; background-color: #ffffff; padding: 20px; border-radius: 6px;">

    <h2 style="margin-top: 0; color: #333;">WasteZero</h2>

    <p style="color: #555; font-size: 14px;">
      Hello,
    </p>

    <p style="color: #555; font-size: 14px;">
      Use the verification code below to complete your request.
    </p>

    <!-- OTP -->
    <div style="text-align: center; margin: 28px 0;">
      <h1 style="
        margin: 0;
        font-weight: bold;
        letter-spacing: 8px;
        color: #000;
      ">
        ${verificationCode}
      </h1>
    </div>

    <p style="color: #555; font-size: 14px;">
      This code is valid for <b>10 minutes</b>.
    </p>

    <p style="color: #888; font-size: 12px;">
      ⚠️ Do not share this code with anyone. WasteZero will never ask for your verification code.
    </p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />

    <p style="color: #aaa; font-size: 11px;">
      If you didn’t request this, you can safely ignore this email.
    </p>

  </div>
</div>`
  });

  console.log(`✅ Code ${verificationCode} sent to ${userEmail}`);

  return verificationCode;
}

module.exports = { sendVerificationEmail };