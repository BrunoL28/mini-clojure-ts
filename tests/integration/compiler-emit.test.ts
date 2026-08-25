import { describe, it } from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { pathToFileURL } from "url";
import { compileSource, DEFAULT_RUNTIME_IMPORT } from "../../src/index.js";

const DIST_RUNTIME = path.join(process.cwd(), "dist", "runtime", "index.js");
const hasBuild = fs.existsSync(DIST_RUNTIME);

describe("Compiler — módulo emitido", () => {
    it("emite o import do runtime por padrão", () => {
        const out = compileSource("(println 1)");
        assert.match(
            out,
            new RegExp(
                `^import \\* as \\$rt from "${DEFAULT_RUNTIME_IMPORT}";`,
                "m",
            ),
        );
    });

    it("permite sobrescrever o especificador do runtime", () => {
        const out = compileSource("(println 1)", {
            runtimeImport: "./runtime.js",
        });
        assert.match(out, /^import \* as \$rt from "\.\/runtime\.js";/m);
    });

    it("o especificador padrão está declarado nos exports do package.json", () => {
        const pkg = JSON.parse(
            fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8"),
        );
        const subpath = DEFAULT_RUNTIME_IMPORT.replace(pkg.name, ".");
        assert.ok(
            pkg.exports[subpath],
            `package.json precisa exportar "${subpath}"`,
        );
    });

    it(
        "o arquivo emitido roda no Node importando o runtime de verdade",
        {
            skip: hasBuild
                ? false
                : "requer `pnpm build` (o CI compila antes de testar)",
        },
        async () => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mclj-emit-"));
            const file = path.join(dir, "gerado.mjs");
            fs.writeFileSync(
                file,
                compileSource(
                    `(def total (reduce + [1 2 3])) (println "total:" total)`,
                    { runtimeImport: pathToFileURL(DIST_RUNTIME).href },
                ),
            );

            const logs: string[] = [];
            const original = console.log;
            try {
                console.log = (...args: any[]) =>
                    logs.push(args.map((a) => String(a)).join(" "));
                await import(pathToFileURL(file).href);
            } finally {
                console.log = original;
                fs.rmSync(dir, { recursive: true, force: true });
            }

            assert.deepStrictEqual(logs, ["total: 6"]);
        },
    );
});
