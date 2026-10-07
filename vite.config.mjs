import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "react-native": "react-native-web" } },
  server: { host: "127.0.0.1", port: 5175, strictPort: true },
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        push: fileURLToPath(new URL("./src/push-worker.js", import.meta.url)),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "push"
            ? "firebase-messaging-sw.js"
            : "assets/[name]-[hash].js",
        manualChunks(id) {
          if (id.includes("node_modules/@firebase/firestore"))
            return "firebase-firestore";
          if (id.includes("node_modules/@firebase/auth"))
            return "firebase-auth";
          if (id.includes("node_modules/leaflet")) return "cartografia";
        },
      },
    },
  },
});
