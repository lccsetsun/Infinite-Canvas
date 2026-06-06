import { spawn } from "node:child_process";
import process from "node:process";

const isWindows = process.platform === "win32";

function startProcess(name, command, extraEnv = {}) {
  const child = spawn(command, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...extraEnv,
    },
    shell: isWindows ? process.env.ComSpec || "cmd.exe" : true,
    stdio: "inherit",
    windowsHide: true,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`[${name}] exited with signal ${signal}`);
      return;
    }
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      process.exitCode = code;
    }
  });

  return child;
}

const serverProcess = startProcess(
  "server",
  "npm run dev:server",
  {
    PORT: "3001",
    EMBED_VITE_MIDDLEWARE: "false",
  }
);

const viteProcess = startProcess(
  "vite",
  "npm run dev:client"
);

let shuttingDown = false;

function stopAll(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of [serverProcess, viteProcess]) {
    if (!child.killed) {
      if (isWindows) {
        spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
          stdio: "ignore",
          windowsHide: true,
        });
      } else {
        child.kill(signal);
      }
    }
  }
}

process.on("SIGINT", () => {
  stopAll("SIGINT");
  process.exit(130);
});

process.on("SIGTERM", () => {
  stopAll("SIGTERM");
  process.exit(143);
});
