import "dotenv/config";
import { spawnSync } from "node:child_process";
function resolvePackageRunner() {
    return process.platform === "win32"
        ? { command: "npx.cmd", args: [] }
        : { command: "npx", args: [] };
}
function runCommand(command, args) {
    const result = spawnSync(command, args, {
        stdio: "inherit",
        shell: process.platform === "win32",
    });
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}
function main() {
    const forwardedArgs = process.argv.slice(2);
    const packageRunner = resolvePackageRunner();
    runCommand(packageRunner.command, [...packageRunner.args, "tsx", "src/scripts/create-admin.ts", ...forwardedArgs]);
}
main();
//# sourceMappingURL=setup-admin.js.map