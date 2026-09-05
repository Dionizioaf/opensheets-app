/**
 * Package the compiled MCP server as a `.mcpb` (Claude Desktop MCP Bundle).
 *
 * Steps:
 *   1. Ensure dist/mcp/server.js exists (skip build with SKIP_BUILD=1).
 *   2. Stage a self-contained directory under dist/mcpb/opensheets-finance/:
 *        - manifest.json (with the current package version filled in)
 *        - server/index.js (copy of the bundled server)
 *        - package.json + node_modules with just the four externalised runtime deps
 *   3. Zip that directory into dist/mcpb/opensheets-finance-<version>.mcpb.
 *
 * The staged directory is what a user would end up with after Claude Desktop
 * unpacks the .mcpb; keeping it around after the run makes local debugging
 * (running `node server/index.js` from inside the staging dir) trivial.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DIST_DIR = path.join(REPO_ROOT, "dist", "mcpb");
const STAGE_DIR = path.join(DIST_DIR, "opensheets-finance");
const BUNDLED_SERVER = path.join(REPO_ROOT, "dist", "mcp", "server.js");
const MANIFEST_TEMPLATE = path.join(REPO_ROOT, "mcp", "mcpb", "manifest.json");

const RUNTIME_DEPS = [
    "@modelcontextprotocol/sdk",
    "drizzle-orm",
    "pg",
    "zod",
];

const rootPackageJson = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"),
) as { version: string; dependencies?: Record<string, string> };
const version = rootPackageJson.version || "0.0.0";
const rootDeps = rootPackageJson.dependencies ?? {};

function step(label: string): void {
    process.stderr.write(`\n▸ ${label}\n`);
}

function run(command: string, args: string[], cwd: string): void {
    const result = spawnSync(command, args, {
        cwd,
        stdio: "inherit",
        env: process.env,
    });
    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(" ")} failed (exit ${result.status ?? "signal"})`);
    }
}

function build(): void {
    if (process.env.SKIP_BUILD === "1" && fs.existsSync(BUNDLED_SERVER)) {
        step("Skipping build (SKIP_BUILD=1)");
        return;
    }
    step("Building MCP server (pnpm mcp:build)");
    const cmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
    run(cmd, ["mcp:build"], REPO_ROOT);
    if (!fs.existsSync(BUNDLED_SERVER)) {
        throw new Error(`Expected bundle not found at ${BUNDLED_SERVER}`);
    }
}

function resetStage(): void {
    step(`Staging ${path.relative(REPO_ROOT, STAGE_DIR)}`);
    if (fs.existsSync(STAGE_DIR)) {
        fs.rmSync(STAGE_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(STAGE_DIR, "server"), { recursive: true });
}

function writeManifest(): void {
    const raw = fs.readFileSync(MANIFEST_TEMPLATE, "utf8");
    const manifest = JSON.parse(raw) as Record<string, unknown>;
    manifest.version = version;
    fs.writeFileSync(
        path.join(STAGE_DIR, "manifest.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
        "utf8",
    );
}

function copyServer(): void {
    fs.copyFileSync(BUNDLED_SERVER, path.join(STAGE_DIR, "server", "index.js"));
}

function writeMiniPackageJson(): void {
    const deps: Record<string, string> = {};
    for (const name of RUNTIME_DEPS) {
        const declared = rootDeps[name];
        if (!declared) {
            throw new Error(
                `Runtime dep ${name} is not declared in root package.json — refusing to guess a version.`,
            );
        }
        deps[name] = declared;
    }
    const miniPkg = {
        name: "opensheets-finance-mcpb",
        version,
        private: true,
        description: "Runtime bundle for the Opensheets Finance MCP server.",
        main: "server/index.js",
        dependencies: deps,
    };
    fs.writeFileSync(
        path.join(STAGE_DIR, "package.json"),
        `${JSON.stringify(miniPkg, null, 2)}\n`,
        "utf8",
    );
}

function installRuntimeDeps(): void {
    step("Installing runtime deps into staging dir (npm install --omit=dev)");
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    run(
        npm,
        [
            "install",
            "--omit=dev",
            "--no-audit",
            "--no-fund",
            "--no-package-lock",
            "--ignore-scripts",
        ],
        STAGE_DIR,
    );
}

function zipBundle(): string {
    const bundleName = `opensheets-finance-${version}.mcpb`;
    const bundlePath = path.join(DIST_DIR, bundleName);
    if (fs.existsSync(bundlePath)) {
        fs.unlinkSync(bundlePath);
    }
    step(`Packing ${path.relative(REPO_ROOT, bundlePath)}`);

    // zip -r bundle.mcpb . from inside STAGE_DIR so paths are relative to the
    // bundle root (manifest.json at top level, not nested under a folder).
    if (process.platform === "win32") {
        // PowerShell's Compress-Archive is not stream-friendly with unicode,
        // but it's the only always-present option. Rename .zip -> .mcpb after.
        const tmpZip = `${bundlePath}.zip`;
        run(
            "powershell",
            [
                "-NoProfile",
                "-Command",
                `Compress-Archive -Path * -DestinationPath '${tmpZip}' -Force`,
            ],
            STAGE_DIR,
        );
        fs.renameSync(tmpZip, bundlePath);
    } else {
        run("zip", ["-qr", bundlePath, "."], STAGE_DIR);
    }

    return bundlePath;
}

function main(): void {
    build();
    resetStage();
    writeManifest();
    copyServer();
    writeMiniPackageJson();
    installRuntimeDeps();
    const bundle = zipBundle();
    const sizeKb = Math.round(fs.statSync(bundle).size / 1024);
    process.stderr.write(
        `\n✓ Wrote ${path.relative(REPO_ROOT, bundle)} (${sizeKb} KB)\n`,
    );
}

main();
