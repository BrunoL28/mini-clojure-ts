import { describe, it } from "node:test";
import assert from "node:assert";
import * as vm from "node:vm";
import * as fs from "fs";
import * as path from "path";
import { parse, compileSource } from "../../src/index.js";
import { transpile } from "../../src/core/Transpiler.js";

/** Transpila a primeira forma do fonte. */
function js(source: string): string {
    const [first] = parse(source);
    return transpile(first!);
}

/** Executa o JS compilado num contexto isolado e devolve o que foi impresso. */
function runCompiled(source: string): string[] {
    const logs: string[] = [];
    const context = vm.createContext({
        console: {
            log: (...args: any[]) => logs.push(args.map(String).join(" ")),
        },
    });
    vm.runInContext(compileSource(source), context);
    return logs;
}

describe("Transpiler — literais de string (#38)", () => {
    it("emite string literal com aspas, não como identificador", () => {
        assert.strictEqual(js('(print "ola")'), 'console.log("ola")');
    });

    it("preserva hífens dentro da string (não aplica mangling)", () => {
        assert.strictEqual(
            js('(print "--- Iniciando ---")'),
            'console.log("--- Iniciando ---")',
        );
    });

    it("preserva ? e ! dentro da string", () => {
        assert.strictEqual(
            js('(print "tudo certo? sim!")'),
            'console.log("tudo certo? sim!")',
        );
    });

    it("escapa aspas, barras e quebras de linha", () => {
        assert.strictEqual(js('(print "a\\"b")'), 'console.log("a\\"b")');
        assert.strictEqual(js('(print "a\\\\b")'), 'console.log("a\\\\b")');
        assert.strictEqual(js('(print "a\\nb")'), 'console.log("a\\nb")');
    });

    it("string vazia continua sendo uma string", () => {
        assert.strictEqual(js('(print "")'), 'console.log("")');
    });

    it("string que parece um símbolo não é convertida em identificador", () => {
        assert.strictEqual(
            js('(print "js/console")'),
            'console.log("js/console")',
        );
    });
});

describe("Transpiler — identificadores", () => {
    it("aplica mangling em símbolos", () => {
        assert.strictEqual(js("(foo-bar 1)"), "foo_bar(1)");
        assert.strictEqual(js("(vazio? 1)"), "vazio$q(1)");
        assert.strictEqual(js("(reset! 1)"), "reset$b(1)");
    });

    it("parâmetros de fn usam a mesma mangling do corpo", () => {
        // Sem isso, o parâmetro sai como `ok?` (JS inválido) e o corpo usa `ok$q`.
        assert.strictEqual(js("(fn [ok?] ok?)"), "((ok$q) => ok$q)");
        assert.strictEqual(js("(fn [a-b] a-b)"), "((a_b) => a_b)");
    });
});

describe("Transpiler — if sem ramo else", () => {
    it('emite null literal, e não a string "null"', () => {
        assert.strictEqual(js("(if x 1)"), "(x ? 1 : null)");
    });

    it("mantém o ramo else quando presente", () => {
        assert.strictEqual(js('(if x "sim" "nao")'), '(x ? "sim" : "nao")');
    });
});

describe("Transpiler — execução ponta a ponta", () => {
    it("o JS gerado executa e imprime as strings corretamente", () => {
        const logs = runCompiled(`
            (print "--- inicio ---")
            (def n 21)
            (print "dobro:" (* n 2))
            (print (if (> n 15) "maior" "menor"))
            (print "--- fim ---")
        `);

        assert.deepStrictEqual(logs, [
            "--- inicio ---",
            "dobro: 42",
            "maior",
            "--- fim ---",
        ]);
    });

    it("tests/compilador.clj compila e executa sem erro", () => {
        const fixture = path.join(process.cwd(), "tests", "compilador.clj");
        const logs = runCompiled(fs.readFileSync(fixture, "utf-8"));

        assert.deepStrictEqual(logs, [
            "--- Iniciando o Programa Compilado ---",
            "Somando a + b...",
            "Resultado da soma: 30",
            "Verificação: É maior que 15",
            "Isto é um console.log nativo do JS!",
        ]);
    });
});
