import { existsSync } from "node:fs";
import { join } from "node:path";

export function dataPath(folder: string, fileName: string) {
  const appRootPath = join(process.cwd(), folder, fileName);
  if (existsSync(appRootPath)) return appRootPath;

  return join(process.cwd(), "..", folder, fileName);
}

export function dataFolder(folder: string) {
  const appRootPath = join(process.cwd(), folder);
  if (existsSync(appRootPath)) return appRootPath;

  return join(process.cwd(), "..", folder);
}
