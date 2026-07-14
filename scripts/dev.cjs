const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const viteCli = path.join(rootDir, "node_modules", "vite", "bin", "vite.js");
const tscCli = path.join(rootDir, "node_modules", "typescript", "bin", "tsc");
const electronCommand = require("electron");

async function main() {
  await run(process.execPath, ["scripts/build-app.cjs"]);
  await run(process.execPath, ["scripts/build-player.cjs"]);
  await run(process.execPath, [
    tscCli,
    "-p",
    "electron/tsconfig.json"
  ]);

  const port = await findFreePort(5173);
  const devUrl = `http://127.0.0.1:${port}`;
  console.log(`StoryLife dev server: ${devUrl}`);

  const vite = start(process.execPath, [
    viteCli,
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort"
  ]);
  await waitForPort(port, vite);

  const electron = start(electronCommand, ["."], {
    ...process.env,
    STORYLIFE_DEV_URL: devUrl
  });

  let stopping = false;
  const stopAll = () => {
    if (stopping) return;
    stopping = true;
    if (!vite.killed) vite.kill();
    if (!electron.killed) electron.kill();
  };

  process.on("SIGINT", stopAll);
  process.on("SIGTERM", stopAll);
  vite.on("exit", stopAll);
  electron.on("exit", stopAll);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = start(command, args);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(command)} exited with code ${code}`));
    });
  });
}

function start(command, args, env = process.env) {
  return spawn(command, args, {
    cwd: rootDir,
    env,
    stdio: "inherit"
  });
}

async function findFreePort(startPort) {
  for (let port = startPort; port < startPort + 100; port += 1) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free development port found after ${startPort}`);
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

function waitForPort(port, child) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const tryConnect = () => {
      const socket = net.connect(port, "127.0.0.1");
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - startedAt > 15000) reject(new Error("Vite did not start in time"));
        else setTimeout(tryConnect, 100);
      });
    };
    child.once("exit", (code) => reject(new Error(`Vite exited with code ${code}`)));
    tryConnect();
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
