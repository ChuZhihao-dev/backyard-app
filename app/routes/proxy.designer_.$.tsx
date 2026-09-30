import { readFile } from "node:fs/promises";
import path from "node:path";
import type { LoaderFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";

const ASSET_PATH = /^assets\/([a-zA-Z0-9._-]+\.(js|css))$/;

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.public.appProxy(request);
  const match = params["*"]?.match(ASSET_PATH);
  if (!match) return new Response("Not found", { status: 404 });

  try {
    const file = await readFile(
      path.join(process.cwd(), "public", "designer-demo", "assets", match[1]),
    );
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": match[1].endsWith(".js")
          ? "text/javascript; charset=utf-8"
          : "text/css; charset=utf-8",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Response("Not found", { status: 404 });
    }
    throw error;
  }
};
