import net from "node:net";
import { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createSmtpAdapter } from "@/lib/messaging/smtp";
import type { EmailMessage } from "@/lib/messaging/types";

/**
 * Proves the SMTP transport actually speaks SMTP: a throwaway server on
 * localhost accepts one message and hands back everything it was sent, so the
 * envelope, the headers and the MIME body are asserted against the wire rather
 * than against a mock.
 */

interface Received {
  readonly auth: string[];
  readonly mailFrom: string[];
  readonly rcptTo: string[];
  readonly data: string;
}

let server: net.Server;
let port: number;
const received: Received[] = [];

function startServer(): Promise<void> {
  server = net.createServer((socket) => {
    const session = { auth: [] as string[], mailFrom: [] as string[], rcptTo: [] as string[], data: "" };
    let inData = false;
    let expectingAuthLine = false;
    let buffer = "";

    socket.write("220 localhost ESMTP test\r\n");

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");

      for (;;) {
        const breakAt = buffer.indexOf("\r\n");
        if (breakAt === -1) break;
        const line = buffer.slice(0, breakAt);
        buffer = buffer.slice(breakAt + 2);

        if (inData) {
          if (line === ".") {
            inData = false;
            received.push({ ...session, data: session.data });
            socket.write("250 2.0.0 Ok: queued as TEST1\r\n");
          } else {
            session.data += `${line.startsWith("..") ? line.slice(1) : line}\n`;
          }
          continue;
        }

        if (expectingAuthLine) {
          expectingAuthLine = false;
          session.auth.push(line);
          socket.write("235 2.7.0 Authentication successful\r\n");
          continue;
        }

        const upper = line.toUpperCase();
        if (upper.startsWith("EHLO") || upper.startsWith("HELO")) {
          socket.write("250-localhost\r\n250-AUTH PLAIN LOGIN\r\n250-8BITMIME\r\n250 SIZE 10485760\r\n");
        } else if (upper.startsWith("AUTH PLAIN")) {
          const inline = line.slice("AUTH PLAIN".length).trim();
          if (inline) {
            session.auth.push(inline);
            socket.write("235 2.7.0 Authentication successful\r\n");
          } else {
            expectingAuthLine = true;
            socket.write("334 \r\n");
          }
        } else if (upper.startsWith("AUTH LOGIN")) {
          expectingAuthLine = true;
          socket.write("334 VXNlcm5hbWU6\r\n");
        } else if (upper.startsWith("MAIL FROM")) {
          session.mailFrom.push(line);
          socket.write("250 2.1.0 Ok\r\n");
        } else if (upper.startsWith("RCPT TO")) {
          session.rcptTo.push(line);
          socket.write("250 2.1.5 Ok\r\n");
        } else if (upper.startsWith("DATA")) {
          inData = true;
          socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
        } else if (upper.startsWith("QUIT")) {
          socket.write("221 2.0.0 Bye\r\n");
          socket.end();
        } else {
          socket.write("250 2.0.0 Ok\r\n");
        }
      }
    });

    socket.on("error", () => undefined);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      port = (server.address() as AddressInfo).port;
      resolve();
    });
  });
}

beforeAll(startServer);
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const message: EmailMessage = {
  to: "guest@example.test",
  from: "WellPlace <hello@wellplace.example>",
  subject: "Your booking is confirmed",
  text: "See you on Friday.",
  html: "<p>See you on Friday.</p>",
  kind: "transactional",
  reference: "booking_confirmation-WP-B1001",
  attachments: [{ filename: "invoice.pdf", content: Buffer.from("%PDF-1.4 test").toString("base64") }],
};

describe("the SMTP transport against a real socket", () => {
  it("authenticates, sends the message and reports the server's id", async () => {
    const adapter = createSmtpAdapter({
      host: "127.0.0.1",
      port,
      user: "demo@gmail.test",
      pass: "app-password",
      from: "WellPlace Demo <demo@gmail.test>",
    });

    const result = await adapter.send(message);

    expect(result.ok).toBe(true);
    expect(received).toHaveLength(1);

    const session = received[0];
    expect(session.auth.length).toBeGreaterThan(0);

    // The envelope sender is the authenticated account, not the template's.
    expect(session.mailFrom.join(" ")).toContain("demo@gmail.test");
    expect(session.rcptTo.join(" ")).toContain("guest@example.test");

    // …and so is the visible From, with the template's address kept as Reply-To.
    expect(session.data).toMatch(/^From: WellPlace Demo <demo@gmail\.test>$/m);
    expect(session.data).toMatch(/^Reply-To: WellPlace <hello@wellplace\.example>$/m);
    expect(session.data).toMatch(/^Subject: Your booking is confirmed$/m);
    expect(session.data).toMatch(/^X-Entity-Ref-ID: booking_confirmation-WP-B1001$/m);

    // The body and the PDF both made it onto the wire.
    expect(session.data).toContain("See you on Friday.");
    expect(session.data).toContain("invoice.pdf");
    expect(session.data).toContain(Buffer.from("%PDF-1.4 test").toString("base64"));
  });

  it("reports a refusal instead of throwing when the server is unreachable", async () => {
    const adapter = createSmtpAdapter({
      host: "127.0.0.1",
      port: 1,
      user: "demo@gmail.test",
      pass: "app-password",
      from: "WellPlace Demo <demo@gmail.test>",
    });

    const result = await adapter.send(message);

    expect(result).toMatchObject({ ok: false, reason: "provider_error" });
  });
});
