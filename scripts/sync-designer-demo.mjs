import { cp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source =
  process.env.BACKYARD_DEMO_DIST ??
  path.resolve(repoRoot, "..", "backyard-3d-demo", "dist");
const destination = path.join(repoRoot, "public", "designer-demo");

async function main() {
  const sourceIndex = path.join(source, "index.html");
  try {
    await readFile(sourceIndex, "utf8");
  } catch {
    console.error(`Designer demo build not found at ${sourceIndex}.`);
    console.error("Build the demo first, or set BACKYARD_DEMO_DIST to its dist folder.");
    process.exit(1);
  }

  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  await cp(source, destination, { recursive: true });

  console.log(`Synced designer demo: ${source} -> ${destination}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
