import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  define: {
    __BASE_PATH__: JSON.stringify("/"),
    __IS_PREVIEW__: JSON.stringify(false),
    __READDY_PROJECT_ID__: JSON.stringify(""),
    __READDY_VERSION_ID__: JSON.stringify(""),
    __READDY_AI_DOMAIN__: JSON.stringify(""),
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    env: {
      VITE_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      VITE_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/lib/**/*.{ts,tsx}",
        "src/utils/**/*.{ts,tsx}",
        "src/components/base/**/*.{ts,tsx}",
        "src/pages/admin/components/NotificationPanel.tsx",
      ],
      exclude: ["**/*.test.{ts,tsx}", "src/test/**"],
    },
  },
});
