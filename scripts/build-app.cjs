const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { build } = require("vite");
const { generatePwaIcons } = require("./generate-pwa-icons.cjs");

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");

async function buildApp() {
  generatePwaIcons(path.join(rootDir, "public", "icons"));

  await build({
    configFile: false,
    root: rootDir,
    base: "./",
    build: {
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: "index.html"
        }
      }
    }
  });

  writeOfflineServiceWorker(distDir);
}

function writeOfflineServiceWorker(outputDir) {
  const relativeFiles = listFiles(outputDir)
    .map((filePath) => path.relative(outputDir, filePath).replaceAll(path.sep, "/"))
    .filter((relativePath) => relativePath !== "sw.js" && relativePath !== ".nojekyll")
    .sort();
  const versionHash = crypto.createHash("sha256");
  for (const relativePath of relativeFiles) {
    versionHash.update(relativePath);
    versionHash.update(fs.readFileSync(path.join(outputDir, relativePath)));
  }

  const cacheName = `storylife-offline-${versionHash.digest("hex").slice(0, 16)}`;
  const precacheUrls = ["./", ...relativeFiles.map((file) => `./${file}`)];
  const source = `const CACHE_NAME = ${JSON.stringify(cacheName)};
const PRECACHE_URLS = ${JSON.stringify(precacheUrls, null, 2)};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("storylife-offline-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;

    if (request.mode === "navigate") {
      const appShell = await caches.match(new URL("./index.html", self.registration.scope));
      if (appShell) return appShell;
    }

    return fetch(request);
  })());
});
`;

  fs.writeFileSync(path.join(outputDir, "sw.js"), source, "utf8");
  console.log(`Offline cache ${cacheName}: ${precacheUrls.length} files.`);
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
}

buildApp().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
