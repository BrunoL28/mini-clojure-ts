import { describe, it } from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as path from "path";
import * as vm from "node:vm";
// IMPORTANTE: este arquivo importa SÓ o entrypoint de browser. Importar
// `src/index.js` instalaria o host de Node no processo e invalidaria os
// testes de "não tem sistema de arquivos". Cada arquivo de teste roda em
// processo separado, então o isolamento vale.
import {
    runSource,
    createGlobalEnv,
    compileSource,
    formatResult,
    getHost,
} from "../../src/browser/index.js";

const BUNDLE = path.join(process.cwd(), "dist", "mini-clojure.global.js");
const RUNTIME_BUNDLE = path.join(process.cwd(), "dist", "runtime.global.js");
const needsBuild = fs.existsSync(BUNDLE)
    ? false
    : "requer `pnpm build` (o CI compila antes de testar)";

function capture(fn: () => void): string[] {
    const logs: string[] = [];
    const original = console.log;
    try {
        console.log = (...a: any[]) => logs.push(a.map(String).join(" "));
        fn();
    } finally {
        console.log = original;
    }
    return logs;
}

function errorOf(fn: () => unknown): string {
    try {
        fn();
        return "";
    } catch (e: any) {
        return e.message;
    }
}

describe("Browser — host sem sistema de arquivos", () => {
    it("o host padrão declara que não tem sistema de arquivos", () => {
        assert.strictEqual(getHost().hasFileSystem, false);
    });

    for (const [nome, codigo] of [
        ["slurp", '(slurp "/etc/passwd")'],
        ["spit", '(spit "/tmp/x" "y")'],
        ["require", '(require "./m.clj")'],
        ["load-file", '(load-file "./m.clj")'],
    ] as [string, string][]) {
        it(`${nome} falha explicando o ambiente`, () => {
            assert.match(
                errorOf(() => runSource(codigo)),
                new RegExp(`${nome} não está disponível neste ambiente`),
            );
        });
    }
});

describe("Browser — a linguagem funciona por inteiro", () => {
    it("interpreta", () => {
        assert.strictEqual(
            runSource("(->> (range 10) (filter even?) (reduce + 0))"),
            20,
        );
    });

    it("mantém estado num ambiente reutilizado", () => {
        const env = createGlobalEnv();
        runSource("(defn dobro [x] (* x 2))", { env });
        assert.strictEqual(runSource("(dobro 21)", { env }), 42);
    });

    it("expande macros", () => {
        assert.strictEqual(
            formatResult(
                runSource(
                    "(defmacro unless (p a b) `(if (not ~p) ~a ~b)) (unless false :sim :nao)",
                ),
            ),
            ":sim",
        );
    });

    it("usa estruturas persistentes", () => {
        const logs = capture(() =>
            runSource(
                `(def m {:a 1 :b {:c 2}}) (println (assoc-in m [:b :c] 99)) (println m)`,
            ),
        );
        assert.deepStrictEqual(logs, ["{:a 1 :b {:c 99}}", "{:a 1 :b {:c 2}}"]);
    });

    it("compila para JavaScript", () => {
        assert.match(compileSource("(println (+ 1 2))"), /\$rt\.core/);
    });

    it("aplica o sandbox", () => {
        assert.match(
            errorOf(() => runSource("js/process", { sandbox: true })),
            /bloqueado/,
        );
    });
});

describe("Browser — bundles", () => {
    it("nenhum bundle referencia módulos de Node", { skip: needsBuild }, () => {
        for (const file of [BUNDLE, RUNTIME_BUNDLE]) {
            const code = fs.readFileSync(file, "utf-8");
            assert.doesNotMatch(
                code,
                /require\(["']fs["']\)|from ?["']fs["']/,
                `${path.basename(file)} não pode referenciar 'fs'`,
            );
        }
    });

    it("o bundle roda sem nenhum global de Node", { skip: needsBuild }, () => {
        const logs: string[] = [];
        const context: any = vm.createContext({
            console: {
                log: (...a: any[]) =>
                    logs.push(a.map((x) => String(x)).join(" ")),
            },
            Math,
            JSON,
            Date,
            String,
            Number,
            Boolean,
            Array,
            Object,
            RegExp,
            Map,
            Set,
            Error,
        });
        context.globalThis = context;

        vm.runInContext(fs.readFileSync(BUNDLE, "utf-8"), context);
        vm.runInContext(
            `console.log(MiniClojure.runSource('(reduce + [1 2 3])'))`,
            context,
        );

        assert.deepStrictEqual(logs, ["6"]);
        // Nada de process/require vazou para dentro do contexto.
        assert.strictEqual(context.process, undefined);
        assert.strictEqual(context.require, undefined);
    });

    it("a página de exemplo aponta para o bundle certo", () => {
        const html = fs.readFileSync(
            path.join(process.cwd(), "examples", "browser", "index.html"),
            "utf-8",
        );
        assert.match(html, /dist\/mini-clojure\.global\.js/);
    });
});
