import twilio from "twilio";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

type WhatsappPayload = {
  to?: string;
  body?: string;
};

type TwilioClient = ReturnType<typeof twilio>;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function parseWhatsappPayload(payloadJson: unknown): WhatsappPayload {
  const normalizeObject = (value: unknown): WhatsappPayload => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    const record = value as Record<string, unknown>;
    return {
      to: typeof record.to === "string" ? record.to : undefined,
      body: typeof record.body === "string" ? record.body : undefined,
    };
  };

  if (typeof payloadJson === "string") {
    try {
      const parsed = JSON.parse(payloadJson) as unknown;
      return normalizeObject(parsed);
    } catch {
      return {};
    }
  }

  return normalizeObject(payloadJson);
}

const accountSid = env.TWILIO_ACCOUNT_SID;
const authToken = env.TWILIO_AUTH_TOKEN;
const fromNumber = env.TWILIO_WHATSAPP_FROM; // should be like 'whatsapp:+1415...'

export async function processWhatsappQueue(batchSize = 50) {
  if (!accountSid || !authToken || !fromNumber) {
    throw new Error("Twilio credentials not configured");
  }

  // create a singleton Twilio client to avoid re-creating it on each call
  const globalWithTwilio = globalThis as typeof globalThis & {
    __twilioClient?: TwilioClient;
  };

  if (!globalWithTwilio.__twilioClient) {
    globalWithTwilio.__twilioClient = twilio(accountSid, authToken);
  }
  const client = globalWithTwilio.__twilioClient;

  const queued = await db.emailOutbox.findMany({ where: { template: "whatsapp", status: "queued" }, take: batchSize });
  for (const row of queued) {
    try {
      const payload = parseWhatsappPayload(row.payloadJson);
      const to = payload.to;
      const body = payload.body;
      if (!to || !body) {
        await db.emailOutbox.update({ where: { id: row.id }, data: { status: "failed", error: "missing payload" } });
        continue;
      }

      const msg = await client.messages.create({ from: fromNumber, to: `whatsapp:${to}`, body });

      await db.emailOutbox.update({ where: { id: row.id }, data: { status: "sent", providerMessageId: msg.sid, sentAt: new Date() } });
    } catch (error) {
      await db.emailOutbox.update({ where: { id: row.id }, data: { status: "failed", error: getErrorMessage(error) } });
    }
  }
}
