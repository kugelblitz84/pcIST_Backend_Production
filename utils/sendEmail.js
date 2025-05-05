import nodemailer from 'nodemailer';

const sendEmail = async ({ emailTo, subject, code, content }) => {

    const senderEmail = process.env.SENDER_EMAIL;
    const senderPass = process.env.SENDER_PASSWORD;

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: senderEmail,
        pass: senderPass,
      },
    });
  
    const message = {
        to: emailTo,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; background-color: #f9f9f9;">
            <h2 style="color: #333;">${subject}</h2>
            <p style="font-size: 16px; color: #555;">
              Hello, <br><br>
              Please use the verification code below to <strong>${content}</strong>.
            </p>
            <div style="font-size: 24px; font-weight: bold; color: #2d89ef; margin: 20px 0; text-align: center;">
              ${code}
            </div>
            <p style="font-size: 14px; color: #777;">
              This code will expire in 10 minutes. If you didn’t request this, please ignore this email.
            </p>
            <p style="font-size: 14px; color: #999; margin-top: 40px;">— pcIST</p>
          </div>
        `
    };

  
    await transporter.sendMail(message);

  };
  
  export default sendEmail;