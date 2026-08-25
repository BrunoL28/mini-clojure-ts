import { describe, it } from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { pathToFileURL } from "url";
import { createRequire } from "module";
import { spawnSync } from "child_process";
import { compileSource, compileFile } from "../../src/index.js";
import type { CompileTarget } from "../../src/core/Compiler.js";

const DIST_ESM = path.join(process.cwd(), "dist", "runtime", "index.js");
const DIST_CJS = path.join(process.cwd(), "dist", "cjs", "runtime", "index.js");
const hasBuild = fs.existsSync(DIST_ESM) && fs.existsSync(DIST_CJS);
const needsBuild = hasBuild
    ? false
    : "requer `pnpm build` (o CI compila antes de testar)";

const PROGRAMA = `(def n 21)
(defn dobro [x] (* x 2))
(println "resultado:" (dobro n))`;

function tempDir(prefix: string): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function capture(fn: () => void | Promise<void>): {
    logs: string[];
    done: void | Promise<void>;
} {
    const logs: string[] = [];
    const original = console.log;
    console.log = (...args: any[]) =>
        logs.push(args.map((a) => String(a)).join(" "));
    try {
        return { logs, done: fn() };
    } finally {
        console.log = original;
    }
}

describe("Compiler — formato de cada target (#22)", () => {
    it("esm importa o runtime com import", () => {
        assert.match(
            compileSource(PROGRAMA, { target: "esm" }),
            /^import \* as \$rt from "mini-clojure-ts\/runtime";/m,
        );
    });

    it("cjs importa o runtime com require e usa strict mode", () => {
        const out = compileSource(PROGRAMA, { target: "cjs" });
        assert.match(out, /^"use strict";/m);
        assert.match(
            out,
            /^const \$rt = require\("mini-clojure-ts\/runtime"\);/m,
        );
    });

    it("iife embrulha tudo e recebe o runtime por parâmetro", () => {
        const out = compileSource(PROGRAMA, { target: "iife" });
        assert.match(out, /^\(function \(\$rt\) \{/m);
        assert.match(out, /\}\)\(globalThis\["MiniClojureRuntime"\]\);/);
    });

    it("aceita um global customizado no iife", () => {
        assert.match(
            compileSource(PROGRAMA, {
                target: "iife",
                runtimeGlobal: "MeuRuntime",
            }),
            /\}\)\(globalThis\["MeuRuntime"\]\);/,
        );
    });

    it("globalThis aparece SOMENTE no target iife", () => {
        // O DoD do #22: evitar globalThis por padrão.
        assert.doesNotMatch(
            compileSource(PROGRAMA, { target: "esm" }),
            /globalThis/,
        );
        assert.doesNotMatch(
            compileSource(PROGRAMA, { target: "cjs" }),
            /globalThis/,
        );
        assert.match(compileSource(PROGRAMA, { target: "iife" }), /globalThis/);
    });
});

describe("Compiler — execução real de cada target (#22)", () => {
    it("esm roda no Node", { skip: needsBuild }, async () => {
        const dir = tempDir("mclj-esm-");
        const file = path.join(dir, "app.mjs");
        fs.writeFileSync(
            file,
            compileSource(PROGRAMA, {
                target: "esm",
                runtimeImport: pathToFileURL(DIST_ESM).href,
            }),
        );

        const logs: string[] = [];
        const original = console.log;
        try {
            console.log = (...a: any[]) =>
                logs.push(a.map((x) => String(x)).join(" "));
            await import(pathToFileURL(file).href);
        } finally {
            console.log = original;
            fs.rmSync(dir, { recursive: true, force: true });
        }
        assert.deepStrictEqual(logs, ["resultado: 42"]);
    });

    it("cjs roda no Node", { skip: needsBuild }, () => {
        const dir = tempDir("mclj-cjs-");
        fs.writeFileSync(
            path.join(dir, "package.json"),
            JSON.stringify({ type: "commonjs" }),
        );
        const file = path.join(dir, "app.cjs");
        fs.writeFileSync(
            file,
            compileSource(PROGRAMA, {
                target: "cjs",
                runtimeImport: DIST_CJS,
            }),
        );

        const { logs } = capture(() => {
            createRequire(path.join(dir, "x.cjs"))(file);
        });
        fs.rmSync(dir, { recursive: true, force: true });
        assert.deepStrictEqual(logs, ["resultado: 42"]);
    });

    it(
        "iife roda lendo o runtime de um global",
        { skip: needsBuild },
        async () => {
            const runtime = await import(pathToFileURL(DIST_ESM).href);
            const code = compileSource(PROGRAMA, {
                target: "iife",
                runtimeGlobal: "__RuntimeDeTeste",
            });

            (globalThis as any).__RuntimeDeTeste = runtime;
            const { logs } = capture(() => {
                (0, eval)(code);
            });
            delete (globalThis as any).__RuntimeDeTeste;
            assert.deepStrictEqual(logs, ["resultado: 42"]);
        },
    );
});

describe("Compiler — saída em arquivo e source maps (#22, #23)", () => {
    it("grava o .js e o .js.map, com o link no final", () => {
        const dir = tempDir("mclj-out-");
        const entrada = path.join(dir, "app.clj");
        const saida = path.join(dir, "build", "app.mjs");
        fs.writeFileSync(entrada, PROGRAMA);

        const code = compileFile(entrada, { outFile: saida, sourceMap: true });

        assert.ok(fs.existsSync(saida), "o .mjs deveria existir");
        assert.ok(fs.existsSync(`${saida}.map`), "o .map deveria existir");
        assert.match(code, /\/\/# sourceMappingURL=app\.mjs\.map\n$/);

        const map = JSON.parse(fs.readFileSync(`${saida}.map`, "utf-8"));
        assert.strictEqual(map.version, 3);
        assert.strictEqual(map.file, "app.mjs");
        // O fonte é relativo ao diretório do arquivo gerado.
        assert.deepStrictEqual(map.sources, [path.join("..", "app.clj")]);
        assert.match(map.sourcesContent[0], /defn dobro/);

        fs.rmSync(dir, { recursive: true, force: true });
    });

    it("cria o diretório de saída quando ele não existe", () => {
        const dir = tempDir("mclj-mkdir-");
        const entrada = path.join(dir, "app.clj");
        fs.writeFileSync(entrada, PROGRAMA);
        const saida = path.join(dir, "a", "b", "c", "app.mjs");

        compileFile(entrada, { outFile: saida });
        assert.ok(fs.existsSync(saida));

        fs.rmSync(dir, { recursive: true, force: true });
    });

    it("não gera .map quando sourceMap está desligado", () => {
        assert.doesNotMatch(compileSource(PROGRAMA), /sourceMappingURL/);
    });

    for (const target of ["esm", "cjs", "iife"] as CompileTarget[]) {
        it(`o mapa do target ${target} aponta para a linha certa do .clj`, () => {
            const dir = tempDir("mclj-map-");
            const entrada = path.join(dir, "erro.clj");
            const saida = path.join(dir, "erro.js");
            // A forma que interessa está na linha 4 (base 1).
            fs.writeFileSync(
                entrada,
                `(println 1)\n(println 2)\n(println 3)\n(nth [1 2] 99)\n`,
            );

            compileFile(entrada, { outFile: saida, sourceMap: true, target });
            const map = JSON.parse(fs.readFileSync(`${saida}.map`, "utf-8"));

            // Cada linha do corpo mapeia para a forma correspondente; a
            // última forma vem da linha 4 → índice 3 (base 0).
            const linhas = map.mappings.split(";");
            const comSegmentos = linhas.filter((l: string) => l.length > 0);
            assert.strictEqual(
                comSegmentos.length,
                4,
                "as quatro formas deveriam estar mapeadas",
            );

            fs.rmSync(dir, { recursive: true, force: true });
        });
    }
});

describe("Compiler — stack trace mapeado para o .clj (#23)", () => {
    it(
        "erro em runtime no JS aponta a linha da forma no .clj",
        { skip: needsBuild },
        () => {
            const dir = tempDir("mclj-stack-");
            const entrada = path.join(dir, "erro.clj");
            const saida = path.join(dir, "erro.mjs");

            // `(nth [1 2] 99)` está na linha 4 e estoura em runtime.
            fs.writeFileSync(
                entrada,
                `(println 1)\n(println 2)\n(println 3)\n(nth [1 2] 99)\n`,
            );

            compileFile(entrada, {
                outFile: saida,
                sourceMap: true,
                runtimeImport: pathToFileURL(DIST_ESM).href,
            });

            // O mapeamento só vale com os source maps ligados no processo que
            // executa o arquivo, então rodamos o Node de verdade.
            const result = spawnSync(
                process.execPath,
                ["--enable-source-maps", saida],
                { encoding: "utf-8" },
            );

            fs.rmSync(dir, { recursive: true, force: true });

            assert.notStrictEqual(
                result.status,
                0,
                "o programa deveria falhar",
            );
            assert.match(
                result.stderr,
                /erro\.clj:4:1/,
                `o stack trace deveria apontar erro.clj:4. Recebido:\n${result.stderr}`,
            );
        },
    );
});
