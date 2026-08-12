import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadFreshManifestModule } from "../services/plugin-loader.js";

describe("loadFreshManifestModule", () => {
  const cleanupPaths = new Set<string>();

  afterEach(async () => {
    for (const cleanupPath of cleanupPaths) {
      await rm(cleanupPath, { recursive: true, force: true });
    }
    cleanupPaths.clear();
  });

  it("ignores stdout written during manifest evaluation", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "paperclip-fresh-manifest-"));
    cleanupPaths.add(tempRoot);

    const manifestPath = path.join(tempRoot, "manifest.js");
    const expected = {
      id: "paperclip.fresh_manifest_stdout",
      apiVersion: 1,
      version: "1.2.3",
      displayName: "Fresh Manifest Stdout Fixture",
      description: "Writes to stdout during evaluation to exercise JSON transport isolation.",
      author: "Paperclip",
      categories: ["automation"],
      capabilities: ["companies.read"],
      entrypoints: {
        worker: "./worker.js",
      },
    };

    await writeFile(
      manifestPath,
      [
        `console.log("noise-before");`,
        `process.stdout.write("noise-write\\n");`,
        `console.log(${JSON.stringify({ polluted: true })});`,
        `export default ${JSON.stringify(expected)};`,
        `console.log("noise-after");`,
      ].join("\n"),
      "utf8",
    );

    await expect(loadFreshManifestModule(manifestPath)).resolves.toEqual(expected);
  });

  it("still fails when the manifest module itself throws", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "paperclip-fresh-manifest-throw-"));
    cleanupPaths.add(tempRoot);

    const manifestPath = path.join(tempRoot, "manifest.js");
    await writeFile(
      manifestPath,
      `throw new Error("boom-from-manifest");\n`,
      "utf8",
    );

    await expect(loadFreshManifestModule(manifestPath)).rejects.toThrow(
      /Failed to load fresh manifest module/,
    );
  });
});
