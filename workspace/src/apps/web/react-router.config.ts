import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "src",
  buildDirectory: "build",
  prerender: ["/"],
  ssr: false,
} satisfies Config;
