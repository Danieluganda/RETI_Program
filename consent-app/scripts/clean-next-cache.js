const fs = require("node:fs");
const path = require("node:path");

const appRoot = process.cwd();
const nextDirs = [".next", ".next-dev"].map((dir) => path.resolve(appRoot, dir));

for (const nextDir of nextDirs) {
  if (!nextDir.startsWith(appRoot)) {
    throw new Error(`Refusing to remove path outside app root: ${nextDir}`);
  }

  fs.rmSync(nextDir, { recursive: true, force: true });
}
