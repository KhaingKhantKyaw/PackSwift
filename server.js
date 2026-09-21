import "dotenv/config";
import compression from "compression";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { apiRouter } from "./src/routes/api.js";
import { pageRouter } from "./src/routes/pages.js";
import { requireSameOrigin } from "./src/middleware/same-origin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(__dirname, "public");
const app = express();
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "127.0.0.1";

app.disable("x-powered-by");
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        styleSrcAttr: ["'unsafe-inline'"],
        scriptSrcAttr: ["'none'"],
        imgSrc: ["'self'", "data:", "https://images.unsplash.com", "https://images.pexels.com"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  }),
);
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "128kb", type: "application/json" }));
app.use(express.urlencoded({ extended: false, limit: "128kb" }));
app.use(requireSameOrigin);
app.use(
  express.static(publicDirectory, {
    extensions: ["html"],
    maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
  }),
);

app.use("/api", apiRouter);
app.use(pageRouter);

app.use((request, response) => {
  response.status(404).sendFile(path.join(publicDirectory, "404.html"));
});

app.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const status = error instanceof RangeError ? 422 : Number(error?.status) || 500;
  if (status >= 500) console.error(error);
  response.status(status).json({
    error: status >= 500 ? "PackSwift could not complete that request." : error.message,
    requestId: request.headers["x-request-id"] ?? null,
  });
});

app.listen(port, host, () => {
  console.log(`PackSwift is available at http://${host}:${port}`);
});
