const { build } = require("vite");

async function buildPlayer() {
  await build({
    configFile: false,
    root: process.cwd(),
    base: "./",
    publicDir: false,
    build: {
      outDir: "dist-player",
      emptyOutDir: true,
      rollupOptions: {
        input: "player.html"
      }
    }
  });
}

buildPlayer().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
