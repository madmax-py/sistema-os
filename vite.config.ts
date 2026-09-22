import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

/**
 * Em desenvolvimento, serve api/progete.ts em /api/progete (na Vercel ela
 * roda sozinha). Assim `npm run dev` funciona sem a Vercel CLI.
 */
function progeteDevApi(): Plugin {
  return {
    name: "progete-dev-api",
    apply: "serve",
    configureServer(server) {
      // Variáveis do servidor (ex.: PROGETE_URL) podem vir do .env.local
      const env = loadEnv(server.config.mode, server.config.envDir || process.cwd(), "");
      for (const [chave, valor] of Object.entries(env)) process.env[chave] ??= valor;

      server.middlewares.use("/api/progete", async (req, res) => {
        try {
          const mod = await server.ssrLoadModule("/api/progete.ts");
          const handler = mod[req.method ?? ""];
          if (typeof handler !== "function") {
            res.statusCode = 405;
            res.end();
            return;
          }
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const headers = new Headers({ "Content-Type": "application/json" });
          if (req.headers.authorization) headers.set("Authorization", req.headers.authorization);
          const response: Response = await handler(
            new Request("http://localhost/api/progete", {
              method: req.method,
              headers,
              body: chunks.length ? Buffer.concat(chunks) : undefined,
            })
          );
          res.statusCode = response.status;
          response.headers.forEach((valor, nome) => res.setHeader(nome, valor));
          res.end(await response.text());
        } catch (e) {
          console.error("[progete-dev-api]", e);
          res.statusCode = 500;
          res.end(JSON.stringify({ erro: String(e) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), progeteDevApi()],
});
