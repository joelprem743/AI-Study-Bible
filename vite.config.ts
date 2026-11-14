import path from "path";
import fs from "fs";
import type { IncomingMessage, ServerResponse } from "http";
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Dev-only: serve the Vercel functions in /api from the Vite dev server,
 * so `npm run dev` works without `vercel dev` or a separate backend.
 * In production these files are deployed as Vercel serverless functions.
 */
function vercelApiDev(env: Record<string, string>): Plugin {
  return {
    name: "vercel-api-dev",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      // Handlers read keys like GROQ_API_KEY from process.env
      for (const [k, v] of Object.entries(env)) {
        if (process.env[k] === undefined) process.env[k] = v;
      }

      server.middlewares.use("/api", async (req, res, next) => {
        const name = (req.url || "").split("?")[0].replace(/^\/+|\/+$/g, "");
        if (!/^[\w-]+$/.test(name)) return next();

        const file = ["ts", "js"]
          .map((ext) => path.resolve(__dirname, "api", `${name}.${ext}`))
          .find((f) => fs.existsSync(f));
        if (!file) return next();

        try {
          const body = await readBody(req);
          const mod = await server.ssrLoadModule(file);
          await mod.default(Object.assign(req, { body }), wrapResponse(res));
        } catch (err: any) {
          console.error(`[api/${name}]`, err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
          }
          res.end(JSON.stringify({ error: err?.message || "Internal Error" }));
        }
      });
    },
  };
}

async function readBody(req: IncomingMessage): Promise<any> {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  if ((req.headers["content-type"] || "").includes("application/json")) {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
}

/** Add the Express/Vercel-style helpers the handlers use. */
function wrapResponse(res: ServerResponse) {
  const r = res as ServerResponse & {
    status: (code: number) => typeof r;
    json: (data: unknown) => typeof r;
    send: (data: unknown) => typeof r;
  };
  r.status = (code) => {
    res.statusCode = code;
    return r;
  };
  r.json = (data) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(data));
    return r;
  };
  r.send = (data) => {
    if (Buffer.isBuffer(data) || typeof data === "string") res.end(data);
    else r.json(data);
    return r;
  };
  return r;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    build: {
      sourcemap: true,
    },
    server: {
      port: 3000,
      strictPort: true,        // 🔴 DO NOT allow port hopping
      host: "localhost",      // 🔴 FIXES Windows + HMR issues
      hmr: {
        port: 3000,           // 🔴 FORCE HMR to same port
      },
    },

    plugins: [react(), vercelApiDev(env)],

    define: {
      "process.env.API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
    },

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
