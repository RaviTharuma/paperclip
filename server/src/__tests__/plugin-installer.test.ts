import { describe, expect, it } from "vitest";
import {
  mergeIgnoreScriptsNpmrc,
  planPluginInstall,
  resolvePluginPackageManager,
} from "../services/plugin-installer.js";

describe("plugin installer package manager", () => {
  it("prefers bun when bun is on PATH", () => {
    expect(resolvePluginPackageManager({}, () => true)).toBe("bun");
    const plan = planPluginInstall("@scope/plug@1.0.0", "/tmp/plugins", {}, () => true);
    expect(plan.command).toBe("bun");
    expect(plan.args).toEqual([
      "add",
      "@scope/plug@1.0.0",
      "--cwd",
      "/tmp/plugins",
      "--ignore-scripts",
    ]);
  });

  it("honors PAPERCLIP_PLUGIN_PACKAGE_MANAGER=npm even if bun exists", () => {
    const env = { PAPERCLIP_PLUGIN_PACKAGE_MANAGER: "npm" };
    expect(resolvePluginPackageManager(env, () => true)).toBe("npm");
    const plan = planPluginInstall("paperclip-plugin-x", "/tmp/plugins", env, () => true);
    expect(plan.args).toEqual([
      "install",
      "paperclip-plugin-x",
      "--prefix",
      "/tmp/plugins",
      "--save",
    ]);
    expect(plan.args).not.toContain("--ignore-scripts");
  });

  it("uses bun when env forces bun", () => {
    expect(
      resolvePluginPackageManager({ PAPERCLIP_PLUGIN_PACKAGE_MANAGER: "bun" }, () => false),
    ).toBe("bun");
  });
});

describe("mergeIgnoreScriptsNpmrc", () => {
  it("writes ignore-scripts into an empty file", () => {
    expect(mergeIgnoreScriptsNpmrc("")).toBe("ignore-scripts=true\n");
  });

  it("keeps registry and auth keys", () => {
    const out = mergeIgnoreScriptsNpmrc("@scope:registry=https://npm.example/\n//npm.example/:_authToken=secret\n");
    expect(out).toContain("@scope:registry=https://npm.example/");
    expect(out).toContain("//npm.example/:_authToken=secret");
    expect(out).toContain("ignore-scripts=true");
  });

  it("forces ignore-scripts=true when already present", () => {
    expect(mergeIgnoreScriptsNpmrc("ignore-scripts=false\nregistry=https://registry.npmjs.org/\n")).toBe(
      "ignore-scripts=true\nregistry=https://registry.npmjs.org/\n",
    );
  });
});
