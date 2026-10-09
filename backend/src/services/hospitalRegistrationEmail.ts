import nodemailer, { Transporter } from 'nodemailer';

let transporter: Transporter | undefined;

export const hospitalRegistrationEmailService = {
  async sendVerificationCode(email: string, code: string): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[development email] Hospital registration code for ${email}: ${code}`);
      return;
    }

    const host = process.env.SMTP_HOST;
    const from = process.env.SMTP_FROM;
    if (!host || !from) {
      throw new Error('SMTP configuration is incomplete');
    }

    if (!transporter) {
      const port = Number.parseInt(process.env.SMTP_PORT || '587', 10);
      transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        ...(process.env.SMTP_USER && process.env.SMTP_PASSWORD
          ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } }
          : {}),
      });
    }

    await transporter.sendMail({
      from,
      to: email,
      subject: 'Verify your DocFlow hospital account',
      text: `Your hospital registration verification code is ${code}. It expires in 10 minutes.`,
    });
  },
};
