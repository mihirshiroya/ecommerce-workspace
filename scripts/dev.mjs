import { spawn } from "node:child_process";
const env = {
  ...process.env,
  API_PORT:
    process.env.API_PORT || String(Number(process.env.DEV_PORT || 3000) + 1),
};
const processes = [
  spawn("node", ["Backend/index.js"], { stdio: "inherit", env }),
  spawn("pnpm", ["--dir", "Frontend", "dev"], {
    stdio: "inherit",
    env,
  }),
];
const stop = () => processes.forEach((p) => p.kill("SIGTERM"));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
processes.forEach((p) =>
  p.on("exit", (code) => {
    if (code) {
      stop();
      process.exit(code);
    }
  }),
);
