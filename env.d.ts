/// <reference types="@cloudflare/workers-types" />

// Cloudflare Email Service (public beta) send() payload and response.
// https://developers.cloudflare.com/email-service/get-started/send-emails/
// https://developers.cloudflare.com/email-service/api/send-emails/rest-api/
type CloudflareEmailAddress = string | { address: string; name?: string };
type CloudflareEmailList = string | string[];

type CloudflareEmailAttachment =
  | {
      content: string; // base64
      disposition: "inline";
      content_id: string;
      filename: string;
      type: string;
    }
  | {
      content: string; // base64
      disposition: "attachment";
      filename: string;
      type: string;
    };

type CloudflareEmailSendPayload = {
  from: CloudflareEmailAddress;
  to: CloudflareEmailList;
  subject: string;
  html?: string;
  text?: string;
  reply_to?: CloudflareEmailAddress;
  cc?: CloudflareEmailList;
  bcc?: CloudflareEmailList;
  headers?: Record<string, string>;
  attachments?: CloudflareEmailAttachment[];
};

// The binding's `send()` resolves with a messageId on success and throws on
// failure. Kept deliberately loose while the beta shape evolves.
type CloudflareEmailSendResult = { messageId?: string } & Record<string, unknown>;

interface CloudflareEmailServiceBinding {
  send(payload: CloudflareEmailSendPayload): Promise<CloudflareEmailSendResult>;
}

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    SEND_EMAIL: CloudflareEmailServiceBinding;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    GOOGLE_REDIRECT_URI: string;
    SESSION_SECRET: string;
    APP_URL: string;
  }

  namespace NodeJS {
    interface ProcessEnv extends CloudflareEnv {}
  }
}

export {};
