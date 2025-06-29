const nodemailer = require("nodemailer");

app.get("/test-email", async (req, res) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "mailpit",
      port: Number(process.env.SMTP_PORT || 1025), // fallback must be inside Number()
      secure: false // Mailpit uses plaintext SMTP, no auth
    });

    await transporter.sendMail({
      from: process.env.MAIL_FROM || '"Test App" <no-reply@dapp.local>',
      to: process.env.TEST_EMAIL_TO || "test@example.com",
      subject: "Mail Server Test",
      text: "✅ Email works!",
      html: "<b>✅ Email works!</b>"
    });

    res.send("📧 Email sent successfully.");
  } catch (err) {
    console.error("Email error:", err);
    res.status(500).json({
      error: "❌ Failed to send email.",
      detail: err.message
    });
  }
});
