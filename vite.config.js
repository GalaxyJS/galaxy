import { defineConfig } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [
    {
      name: "copy-dist",
      closeBundle() {
        const distPath = path.resolve(__dirname, "dist");
        const targetPath = path.resolve(__dirname, "site/galaxyjs"); // ← Fixed

        if (!fs.existsSync(distPath)) {
          console.log("⚠️ dist folder not found, skipping copy.");
          return;
        }

        try {
          // Create target folder if it doesn't exist
          if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
          }

          copyDir(distPath, targetPath);
          console.log(`✅ Successfully copied dist to ${targetPath}`);
        } catch (error) {
          console.error("❌ Failed to copy dist:", error.message);
        }
      },
    },
  ],
  build: {
    sourcemap: true,
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: "./main.js",
      name: "GalaxyJS",
      // the proper extensions will be added
      fileName: "galaxy",
      formats: ["es", "iife"],
    },
    rollupOptions: {
      // input: {
      //   main: resolve(__dirname, 'index.html'),
      // },
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: ["/site"],
      output: {
        // Provide global variables to use in the UMD build
        // for externalized deps
        globals: {},
      },
    },
  },
});

// Helper function to copy directory
function copyDir(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
