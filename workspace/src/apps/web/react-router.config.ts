import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "src",
  buildDirectory:
    process.env.BLUE_APP_TARGET && process.env.BLUE_APP_TARGET !== "all"
      ? `build/${process.env.BLUE_APP_TARGET}`
      : "build",
  prerender: ["/"],
  ssr: false,
} satisfies Config;
