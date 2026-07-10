const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const rootDir = process.cwd();
const distDir = path.resolve(rootDir, "dist");
const docsDir = path.resolve(rootDir, "docs");

if (path.dirname(docsDir) !== rootDir || path.basename(docsDir) !== "docs") {
  throw new Error("Refusing to replace an unexpected iPad output directory.");
}

const buildResult = spawnSync(
  process.execPath,
  [path.join(rootDir, "scripts", "build-app.cjs")],
  { cwd: rootDir, stdio: "inherit" }
);
if (buildResult.status !== 0) process.exit(buildResult.status ?? 1);

fs.rmSync(docsDir, { recursive: true, force: true });
fs.cpSync(distDir, docsDir, { recursive: true });

const verifyResult = spawnSync(
  process.execPath,
  [path.join(rootDir, "scripts", "verify-ipad-build.cjs")],
  { cwd: rootDir, stdio: "inherit" }
);
if (verifyResult.status !== 0) process.exit(verifyResult.status ?? 1);

console.log(`iPad offline build ready: ${docsDir}`);
