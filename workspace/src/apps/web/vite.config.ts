import tailwindcss from "@tailwindcss/vite";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, loadEnv } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    define: {
      "import.meta.env.VITE_APP_TARGET": JSON.stringify(
        process.env.BLUE_APP_TARGET ?? "customer",
      ),
      "import.meta.env.VITE_API_MODE": JSON.stringify(
        process.env.VITE_API_MODE ?? env.VITE_API_MODE ?? "mock",
      ),
    },
    server: {
      proxy: {
        ...(env.API_TRANSPORT_PROXY_TARGET
          ? {
              "^/api/v1/operator/(drivers|driver-files|resource-metadata|buses|trips)(/|[?]|$)":
                {
                  target: env.API_TRANSPORT_PROXY_TARGET,
                  changeOrigin: true,
                },
            }
          : {}),
        "/api/v1": {
          target:
            process.env.API_PROXY_TARGET ||
            env.API_PROXY_TARGET ||
            "http://localhost:5080",
          changeOrigin: true,
        },
      },
    },
    plugins: [tailwindcss(), reactRouter()],
    // Route modules load lazily; prebundle their shared dependencies before first navigation.
    optimizeDeps: {
      include: [
        "@phosphor-icons/react/dist/csr/List",
        "@phosphor-icons/react/dist/csr/X",
        "@phosphor-icons/react/dist/csr/Bus",
        "@phosphor-icons/react/dist/csr/Ticket",
        "date-fns",
        "date-fns/locale",
        "@radix-ui/react-dialog",
        "@tanstack/react-query",
        "msw",
        "msw/browser",
        "zod",
        "zustand",
        "zustand/middleware",
        "@phosphor-icons/react/dist/csr/Armchair",
        "@phosphor-icons/react/dist/csr/Check",
        "@phosphor-icons/react/dist/csr/Clock",
        "@phosphor-icons/react/dist/csr/LockSimple",
        "@phosphor-icons/react/dist/csr/Prohibit",
        "@phosphor-icons/react/dist/csr/WarningCircle",
        "@phosphor-icons/react/dist/csr/User",
        "@phosphor-icons/react/dist/csr/DeviceMobile",
        "@phosphor-icons/react/dist/csr/EnvelopeSimple",
        "@phosphor-icons/react/dist/csr/MapPin",
        "@phosphor-icons/react/dist/csr/ShieldCheck",
        "@phosphor-icons/react/dist/csr/CheckCircle",
        "@phosphor-icons/react/dist/csr/QrCode",
      ],
    },
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
  };
});
