const fs = require("node:fs");
const path = require("node:path");

const appRoot = process.cwd();
const nextDir = path.resolve(appRoot, ".next");

if (!nextDir.startsWith(appRoot)) {
  throw new Error(`Refusing to remove path outside app root: ${nextDir}`);
}

fs.rmSync(nextDir, { recursive: true, force: true });
