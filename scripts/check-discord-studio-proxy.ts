import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
const root = process.cwd(),
  nativeRequire = createRequire(import.meta.url);
function load(file: string, overrides: Record<string, unknown> = {}) {
  const module = { exports: {} };
  const js = ts.transpileModule(
    fs.readFileSync(path.join(root, file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    },
  ).outputText;
  vm.runInNewContext(js, {
    module,
    exports: module.exports,
    require: (id: string) =>
      id === "server-only" ? {} : (overrides[id] ?? nativeRequire(id)),
    Request,
    Response,
    Headers,
    URL,
    Buffer,
    AbortSignal,
    setTimeout,
    clearTimeout,
    process: { env: { DISCORD_STUDIO_BRIDGE_SECRET: "ab".repeat(32) } },
  });
  return module.exports as Record<string, any>;
}
async function main() {
  const proxy = load("lib/discordStudioProxy.ts");
  let calls = 0,
    captured: any;
  const fetcher = async (url: string, options: any) => {
    calls++;
    captured = { url, options };
    return new Response("ok", {
      headers: { "content-type": "text/html", "x-frame-options": "SAMEORIGIN" },
    });
  };
  const req = (url: string, method = "GET", origin?: string) =>
    new Request(url, {
      method,
      headers: {
        ...(origin ? { origin } : {}),
        cookie: "website-session-must-not-forward",
      },
      ...(method === "POST" ? { body: "{}" } : {}),
    });
  const opts = { userId: "admin-user", secret: "ab".repeat(32), fetcher };
  assert.equal(
    (
      await proxy.proxyDiscordStudio(
        req("https://aclassstore.com/api/admin/discord-studio/ui/index.html"),
        ["ui", "index.html"],
        opts,
      )
    ).status,
    200,
  );
  assert.equal(captured.url, "http://127.0.0.1:3710/index.html");
  assert.ok(captured.options.headers["x-studio-signature"]);
  assert.equal(captured.options.headers.cookie, undefined);
  assert.equal(
    (
      await proxy.proxyDiscordStudio(
        req(
          "https://aclassstore.com/api/admin/discord-studio/api/settings",
          "POST",
          "https://evil.example",
        ),
        ["api", "settings"],
        opts,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await proxy.proxyDiscordStudio(
        req(
          "http://localhost:3000/api/admin/discord-studio/api/preview",
          "POST",
          "https://aclassstore.com",
        ),
        ["api", "preview"],
        { ...opts, publicOrigin: "https://aclassstore.com" },
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await proxy.proxyDiscordStudio(
        req("https://aclassstore.com/x"),
        ["ui", "..", ".env"],
        opts,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await proxy.proxyDiscordStudio(
        req("https://aclassstore.com/x"),
        ["api", "login"],
        opts,
      )
    ).status,
    404,
  );
  let role = "user";
  const route = load("app/api/admin/discord-studio/[...path]/route.ts", {
    "next-auth": {
      getServerSession: async () =>
        role === "none" ? null : { user: { id: "admin-user", role } },
    },
    "@/lib/auth": { authOptions: {} },
    "@/lib/adminAuth": {
      validateAdmin: async (roles: string[]) =>
        roles.includes(role)
          ? { isValid: true, session: { user: { id: "admin-user", role } } }
          : {
              isValid: false,
              response: Response.json({ error: "Forbidden" }, { status: 403 }),
            },
    },
    "@/lib/discordStudioProxy": {
      proxyDiscordStudio: async () => {
        calls++;
        return Response.json({ ok: true });
      },
    },
  });
  const before = calls;
  for (role of ["user", "partnership"])
    assert.equal(
      (
        await route.GET(req("https://aclassstore.com/x"), {
          params: Promise.resolve({ path: ["api", "state"] }),
        })
      ).status,
      403,
    );
  assert.equal(calls, before);
  role = "none";
  assert.equal(
    (
      await route.GET(req("https://aclassstore.com/x"), {
        params: Promise.resolve({ path: ["api", "state"] }),
      })
    ).status,
    401,
  );
  role = "admin";
  assert.equal(
    (
      await route.GET(req("https://aclassstore.com/x"), {
        params: Promise.resolve({ path: ["api", "state"] }),
      })
    ).status,
    200,
  );
  console.log(
    "Discord Studio proxy: admin gate, origin, path safety, signed requests and credential isolation passed",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
