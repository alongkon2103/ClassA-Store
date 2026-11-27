import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";

const LIMIT = 9 * 1024 * 1024;
type Options = {
  userId: string;
  secret?: string;
  fetcher?: typeof fetch;
  publicOrigin?: string;
};
async function readBody(request: Request) {
  if (["GET", "HEAD"].includes(request.method)) return Buffer.alloc(0);
  if (Number(request.headers.get("content-length") || 0) > LIMIT)
    throw new Error("BODY_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      bytes += item.value.byteLength;
      if (bytes > LIMIT) {
        await reader.cancel();
        throw new Error("BODY_TOO_LARGE");
      }
      chunks.push(item.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export async function proxyDiscordStudio(
  request: Request,
  segments: string[],
  {
    userId,
    secret,
    fetcher = fetch,
    publicOrigin = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL,
  }: Options,
) {
  if (
    !segments.length ||
    segments.some((p) => !p || p === "." || p === ".." || /[\\/\x00]/.test(p))
  )
    return Response.json({ error: "Not found" }, { status: 404 });
  let targetPath: string;
  if (segments[0] === "ui" && request.method === "GET") {
    const resource = segments.slice(1).join("/");
    if (
      resource !== "index.html" &&
      !/^assets\/[A-Za-z0-9_.-]+\.(js|css|woff2|png|svg)$/.test(resource)
    )
      return Response.json({ error: "Not found" }, { status: 404 });
    targetPath = "/" + resource;
  } else {
    targetPath = "/" + segments.join("/");
    if (
      !/^\/api\/(session|bootstrap|state|preview|settings|publish|documents(?:\/[a-f0-9]{24})?|media(?:\/[a-f0-9]{24})?|publications\/[a-f0-9]{24}\/(?:retry|reconcile))$/.test(
        targetPath,
      )
    )
      return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!["GET", "HEAD", "POST", "PUT", "DELETE"].includes(request.method))
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  const url = new URL(request.url);
  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    let expectedOrigin = url.origin;
    if (publicOrigin) {
      try {
        expectedOrigin = new URL(publicOrigin).origin;
      } catch {
        return Response.json(
          { error: "Invalid website origin configuration" },
          { status: 503 },
        );
      }
    }
    if (!origin || origin !== expectedOrigin)
      return Response.json({ error: "Invalid origin" }, { status: 403 });
  }
  if (!secret || !/^[a-f0-9]{64,128}$/.test(secret))
    return Response.json(
      { error: "Discord Studio bridge is not configured" },
      { status: 503 },
    );
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(userId))
    return Response.json({ error: "Invalid admin session" }, { status: 403 });
  let body: Buffer;
  try {
    body = await readBody(request);
  } catch {
    return Response.json(
      { error: "Upload exceeds the request limit" },
      { status: 413 },
    );
  }
  const timestamp = String(Math.floor(Date.now() / 1000)),
    nonce = randomBytes(16).toString("hex"),
    upstreamPath = targetPath + url.search;
  const canonical = [
    request.method,
    upstreamPath,
    userId,
    timestamp,
    nonce,
    createHash("sha256").update(body).digest("hex"),
  ].join("\n");
  const headers: Record<string, string> = {
    "x-studio-user": userId,
    "x-studio-time": timestamp,
    "x-studio-nonce": nonce,
    "x-studio-signature": createHmac("sha256", secret)
      .update(canonical)
      .digest("hex"),
  };
  const type = request.headers.get("content-type");
  if (type) headers["content-type"] = type;
  try {
    const upstream = await fetcher("http://127.0.0.1:3710" + upstreamPath, {
      method: request.method,
      headers,
      body: body.length ? new Uint8Array(body) : undefined,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(120_000),
    });
    if (upstream.status >= 300 && upstream.status < 400)
      return Response.json(
        { error: "Unexpected console redirect" },
        { status: 502 },
      );
    const responseHeaders = new Headers({
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-frame-options": "SAMEORIGIN",
      "referrer-policy": "no-referrer",
    });
    for (const key of [
      "content-type",
      "content-disposition",
      "content-security-policy",
    ]) {
      const value = upstream.headers.get(key);
      if (value) responseHeaders.set(key, value);
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      { error: "Discord Studio is temporarily unavailable. Please try again." },
      { status: 502 },
    );
  }
}
