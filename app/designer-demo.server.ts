import { access } from "node:fs/promises";
import path from "node:path";

async function exists(target: string) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves the directory that contains the built designer demo.
 * In production (`react-router build`) static assets live in `build/client`,
 * while during local development they are served from `public`.
 */
export async function designerDemoDir() {
  const candidates = [
    path.join(process.cwd(), "build", "client", "designer-demo"),
    path.join(process.cwd(), "public", "designer-demo"),
  ];

  for (const dir of candidates) {
    if (await exists(path.join(dir, "index.html"))) return dir;
  }

  return path.join(process.cwd(), "public", "designer-demo");
}
