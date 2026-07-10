const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const rootDir = process.cwd();
const docsDir = path.resolve(rootDir, "docs");
const scope = "https://offline.storylife.test/storylife/";

async function verifyIpadBuild() {
  const workerSource = fs.readFileSync(path.join(docsDir, "sw.js"), "utf8");
  const listeners = new Map();
  const cacheStores = new Map();

  const caches = {
    async open(name) {
      if (!cacheStores.has(name)) cacheStores.set(name, new Map());
      const store = cacheStores.get(name);
      return {
        async addAll(urls) {
          for (const rawUrl of urls) {
            const absoluteUrl = new URL(rawUrl, scope).href;
            const filePath = filePathForUrl(absoluteUrl);
            assert.ok(fs.existsSync(filePath), `Offline cache references missing file: ${rawUrl}`);
            store.set(absoluteUrl, {
              url: absoluteUrl,
              body: fs.readFileSync(filePath)
            });
          }
        },
        async keys() {
          return [...store.keys()].map((url) => ({ url }));
        }
      };
    },
    async keys() {
      return [...cacheStores.keys()];
    },
    async delete(name) {
      return cacheStores.delete(name);
    },
    async match(request, options = {}) {
      const rawUrl = typeof request === "string" ? request : request.url;
      let absoluteUrl = new URL(rawUrl, scope).href;
      if (options.ignoreSearch) {
        const parsed = new URL(absoluteUrl);
        parsed.search = "";
        absoluteUrl = parsed.href;
      }
      for (const store of cacheStores.values()) {
        if (store.has(absoluteUrl)) return store.get(absoluteUrl);
      }
      return undefined;
    }
  };

  const self = {
    location: { origin: new URL(scope).origin },
    registration: { scope },
    clients: { async claim() {} },
    async skipWaiting() {},
    addEventListener(type, listener) {
      listeners.set(type, listener);
    }
  };

  vm.runInNewContext(workerSource, {
    URL,
    Promise,
    caches,
    self,
    fetch: async () => {
      throw new Error("Network is disabled during iPad offline verification.");
    }
  });

  assert.ok(listeners.has("install"), "Service worker has no install handler.");
  assert.ok(listeners.has("fetch"), "Service worker has no offline fetch handler.");

  let installPromise;
  listeners.get("install")({ waitUntil(promise) { installPromise = promise; } });
  await installPromise;

  const expectedFiles = listFiles(docsDir)
    .map((filePath) => path.relative(docsDir, filePath).replaceAll(path.sep, "/"))
    .filter((relativePath) => relativePath !== "sw.js" && relativePath !== ".nojekyll")
    .sort();
  const cachedUrls = [...cacheStores.values()].flatMap((store) => [...store.keys()]);
  for (const relativePath of expectedFiles) {
    const expectedUrl = new URL(`./${relativePath}`, scope).href;
    assert.ok(cachedUrls.includes(expectedUrl), `File was not precached: ${relativePath}`);
  }

  await assertOfflineResponse(listeners.get("fetch"), {
    method: "GET",
    mode: "navigate",
    url: scope
  });
  for (const relativePath of expectedFiles) {
    await assertOfflineResponse(listeners.get("fetch"), {
      method: "GET",
      mode: "same-origin",
      url: new URL(`./${relativePath}`, scope).href
    });
  }

  const manifest = JSON.parse(
    fs.readFileSync(path.join(docsDir, "manifest.webmanifest"), "utf8")
  );
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "./");
  assert.ok(
    manifest.icons.some((icon) => icon.sizes === "512x512"),
    "Manifest is missing its 512px install icon."
  );

  console.log(
    `Verified airplane-mode startup and ${expectedFiles.length} cached build files.`
  );
}

async function assertOfflineResponse(fetchListener, request) {
  let responsePromise;
  fetchListener({
    request,
    respondWith(promise) {
      responsePromise = promise;
    }
  });
  assert.ok(responsePromise, `Service worker ignored ${request.url}`);
  const response = await responsePromise;
  assert.ok(response?.body?.length > 0, `No offline response for ${request.url}`);
}

function filePathForUrl(absoluteUrl) {
  const url = new URL(absoluteUrl);
  const relativePath = decodeURIComponent(url.pathname.slice(new URL(scope).pathname.length));
  return path.join(docsDir, relativePath || "index.html");
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
}

verifyIpadBuild().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
