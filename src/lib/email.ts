import "server-only";
import nodemailer from "nodemailer";

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  NOTIFY_EMAIL,
} = process.env;

function canSend() {
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_FROM);
}

async function getTransport() {
  if (!canSend()) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
}

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
};

export async function sendEmail({ to, subject, text }: EmailPayload) {
  const transport = await getTransport();
  if (!transport) {
    console.warn("Email not sent: SMTP not configured.");
    return false;
  }

  await transport.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    text,
  });

  return true;
}

type SellerNotice = {
  sellerId: string;
  email: string;
  displayName: string;
};

export async function notifySellerApplication({
  sellerId,
  email,
  displayName,
}: SellerNotice) {
  const recipient = NOTIFY_EMAIL ?? "achyuta.2006@gmail.com";
  if (!recipient) return false;

  return sendEmail({
    to: recipient,
    subject: "New seller verification request",
    text: `Seller application received.\n\nSeller ID: ${sellerId}\nName: ${displayName}\nEmail: ${email}`,
  });
}

type SellerDecision = {
  sellerId: string;
  email: string;
  displayName: string;
  status: "APPROVED" | "REJECTED";
  notes?: string | null;
};

export async function notifySellerDecision({
  sellerId,
  email,
  displayName,
  status,
  notes,
}: SellerDecision) {
  if (!email) return false;

  return sendEmail({
    to: email,
    subject: `Seller verification ${status.toLowerCase()}`,
    text: `Your seller verification has been ${status.toLowerCase()}.

Seller ID: ${sellerId}
Name: ${displayName}

${notes ? `Notes: ${notes}` : ""}`,
  });
}
