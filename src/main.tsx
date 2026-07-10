import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "reactflow/dist/style.css";
import "./styles/app.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void registerOfflineApp();
  });
}

async function registerOfflineApp() {
  try {
    const registration = await navigator.serviceWorker.register("./sw.js", {
      scope: "./"
    });
    const installingWorker = registration.installing;
    if (installingWorker && installingWorker.state !== "activated") {
      await new Promise<void>((resolve, reject) => {
        installingWorker.addEventListener("statechange", () => {
          if (installingWorker.state === "activated") resolve();
          if (installingWorker.state === "redundant") {
            reject(new Error("Offline installation was rejected."));
          }
        });
      });
    }
    await navigator.serviceWorker.ready;
    document.documentElement.dataset.offlineReady = "true";
    window.dispatchEvent(new Event("storylife:offline-ready"));
  } catch {
    window.dispatchEvent(new Event("storylife:offline-error"));
  }
}
