/**
 * Resolve which package manager installs runtime Paperclip plugins.
 *
 * `plugin install` used to hardcode `npm install --prefix … --ignore-scripts`.
 * That breaks npm 12 (EALLOWSCRIPTS) and ignores Bun even when the operator
 * runs the CLI via bun.
 */
import { existsSync } from "node:fs";
import path from "node:path";

export type PluginPackageManager = "bun" | "npm";

export type PluginInstallPlan = {
  command: string;
  args: string[];
  manager: PluginPackageManager;
};

export function commandOnPath(bin: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const pathEnv = env.PATH ?? env.Path ?? "";
  const sep = process.platform === "win32" ? ";" : ":";
  const exts = process.platform === "win32" ? ["", ".cmd", ".exe"] : [""];
  for (const dir of pathEnv.split(sep)) {
    if (!dir) continue;
    for (const ext of exts) {
      if (existsSync(path.join(dir, bin + ext))) return true;
    }
  }
  return false;
}

function npmBin(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

/**
 * Choose bun when requested or when bun is on PATH; otherwise npm.
 * Override with PAPERCLIP_PLUGIN_PACKAGE_MANAGER=bun|npm.
 */
export function resolvePluginPackageManager(
  env: NodeJS.ProcessEnv = process.env,
  which: (bin: string) => boolean = commandOnPath,
): PluginPackageManager {
  const raw = (env.PAPERCLIP_PLUGIN_PACKAGE_MANAGER ?? "").trim().toLowerCase();
  if (raw === "npm") return "npm";
  if (raw === "bun") return "bun";
  if (which("bun")) return "bun";
  return "npm";
}

export function planPluginInstall(
  spec: string,
  prefix: string,
  env: NodeJS.ProcessEnv = process.env,
  which: (bin: string) => boolean = commandOnPath,
): PluginInstallPlan {
  const manager = resolvePluginPackageManager(env, which);
  if (manager === "bun") {
    return {
      manager,
      command: "bun",
      args: ["add", spec, "--cwd", prefix, "--ignore-scripts"],
    };
  }
  // npm 12 rejects --ignore-scripts on project-scoped installs (EALLOWSCRIPTS).
  // Prefer a prefix .npmrc `ignore-scripts=true` written by the caller.
  return {
    manager,
    command: npmBin(),
    args: ["install", spec, "--prefix", prefix, "--save"],
  };
}

export const NPMRC_IGNORE_SCRIPTS = "ignore-scripts=true\n";

/** Keep existing prefix .npmrc keys; only set ignore-scripts=true. */
export function mergeIgnoreScriptsNpmrc(existing: string): string {
  const text = existing.replace(/\r\n/g, "\n");
  if (/(^|\n)ignore-scripts\s*=/im.test(text)) {
    return text.replace(/(^|\n)ignore-scripts\s*=.*$/im, "$1ignore-scripts=true") + (text.endsWith("\n") ? "" : "\n");
  }
  const trimmed = text.replace(/\s+$/g, "");
  return (trimmed ? trimmed + "\n" : "") + NPMRC_IGNORE_SCRIPTS;
}
