import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import { runSource } from "../../src/index.js";
import { setPrintLimits } from "../../src/core/Limits.js";
import { ppStr } from "../../src/core/PrettyPrinter.js";

function reset() {
    setPrintLimits({ length: null, level: null, width: 80 });
}

/** Todas as linhas de uma saída formatada. */
function linhas(codigo: string): string[] {
    return (runSource(codigo) as string).split("\n");
}

describe("Pretty-printer — cabe numa linha (#35)", () => {
    afterEach(reset);

    it("dado pequeno sai igual ao pr-str", () => {
        assert.strictEqual(
            runSource("(pprint-str {:a 1 :b 2})"),
            "{:a 1 :b 2}",
        );
        assert.strictEqual(runSource("(pprint-str [1 2 3])"), "[1 2 3]");
        assert.strictEqual(runSource("(pprint-str 42)"), "42");
        assert.strictEqual(runSource("(pprint-str nil)"), "nil");
    });

    it("não quebra o que cabe, mesmo aninhado", () => {
        assert.strictEqual(
            runSource("(pprint-str {:a {:b 1}})"),
            "{:a {:b 1}}",
        );
    });
});

describe("Pretty-printer — quebra e alinhamento (#35)", () => {
    afterEach(reset);

    it("mapa grande vira uma entrada por linha, alinhada", () => {
        const saida = linhas(
            '(pprint-str {:nome "ana" :idade 30 :tags [:admin :dev :ops] :endereco {:cidade "sao paulo" :cep "01000-000"}})',
        );

        assert.ok(saida.length > 1, "deveria quebrar");
        assert.ok(saida[0]!.startsWith("{"));
        // As linhas seguintes alinham uma coluna adiante da chave `{`.
        for (const linha of saida.slice(1)) {
            assert.ok(
                linha.startsWith(" "),
                `esperava alinhamento em: ${linha}`,
            );
        }
        assert.ok(saida[saida.length - 1]!.endsWith("}"));
    });

    it("sequência de escalares preenche a linha em vez de um por linha", () => {
        const saida = linhas("(pprint-str (into [] (range 60)))");
        assert.ok(saida.length > 1, "deveria quebrar");
        assert.ok(
            saida.length < 10,
            `deveria preencher, mas usou ${saida.length} linhas`,
        );
        assert.match(saida[0]!, /^\[0 1 2 3/);
    });

    it("nenhuma linha passa da largura", () => {
        for (const width of [80, 40, 20]) {
            setPrintLimits({ width });
            for (const codigo of [
                "(pprint-str (into [] (range 500)))",
                '(pprint-str {:a (into [] (range 40)) :b "texto" :c {:d (into [] (range 20))}})',
            ]) {
                for (const linha of linhas(codigo)) {
                    assert.ok(
                        linha.length <= width,
                        `largura ${width}: linha com ${linha.length} chars: ${linha}`,
                    );
                }
            }
        }
    });

    it("a largura é configurável de dentro da linguagem", () => {
        assert.strictEqual(
            runSource("(do (set-print-width! 20) (:width (print-limits)))"),
            20,
        );
        const saida = linhas(
            "(do (set-print-width! 20) (pprint-str (into [] (range 20))))",
        );
        assert.ok(saida.length > 1);
    });

    it("recusa largura inválida", () => {
        assert.throws(
            () => runSource("(set-print-width! 0)"),
            /espera um número >= 1/,
        );
    });
});

describe("Pretty-printer — respeita os limites de impressão (#35)", () => {
    afterEach(reset);

    it("aplica print-length", () => {
        setPrintLimits({ length: 5 });
        assert.strictEqual(
            runSource("(pprint-str (into [] (range 100)))"),
            "[0 1 2 3 4 ...]",
        );
    });

    it("aplica print-length também quando quebra", () => {
        setPrintLimits({ length: 3, width: 20 });
        const saida = runSource(
            '(pprint-str {:a "valor longo aqui" :b 2 :c 3 :d 4 :e 5})',
        ) as string;
        assert.match(saida, /\.\.\./);
    });
});

describe("Pretty-printer — API direta (#35)", () => {
    afterEach(reset);

    it("aceita recuo inicial, para encaixar em texto já indentado", () => {
        const dados = [1, 2, 3];
        assert.strictEqual(ppStr(dados, { width: 80 }), "(1 2 3)");
        // Com pouca largura restante, quebra mesmo sendo pequeno.
        assert.ok(ppStr(dados, { width: 8, indent: 5 }).includes("\n"));
    });

    it("pprint imprime e devolve nil", () => {
        const logs: string[] = [];
        const original = console.log;
        try {
            console.log = (...a: any[]) => logs.push(a.map(String).join(" "));
            assert.strictEqual(runSource("(pprint [1 2 3])"), null);
        } finally {
            console.log = original;
        }
        assert.deepStrictEqual(logs, ["[1 2 3]"]);
    });
});
