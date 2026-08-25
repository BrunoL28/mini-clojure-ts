import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import { runSource } from "../../src/index.js";
import {
    setPrintLimits,
    getPrintLimits,
    clearTimeLimit,
} from "../../src/core/Limits.js";

function semLimites() {
    setPrintLimits({ length: null, level: null });
    clearTimeLimit();
}

function erroDe(fn: () => unknown): string {
    try {
        fn();
        return "";
    } catch (e: any) {
        return e.message;
    }
}

describe("Limites — impressão (#30)", () => {
    afterEach(semLimites);

    it("sem limite por padrão, para pr-str continuar fazendo roundtrip", () => {
        semLimites();
        assert.deepStrictEqual(getPrintLimits(), { length: null, level: null });
        assert.strictEqual(
            runSource("(pr-str (range 20))"),
            "(0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19)",
        );
    });

    it("print-length trunca com reticências", () => {
        setPrintLimits({ length: 3 });
        assert.strictEqual(runSource("(pr-str (range 100))"), "(0 1 2 ...)");
        assert.strictEqual(runSource("(pr-str [1 2 3 4 5])"), "[1 2 3 ...]");
    });

    it("print-length não trunca o que já cabe", () => {
        setPrintLimits({ length: 5 });
        assert.strictEqual(runSource("(pr-str [1 2 3])"), "[1 2 3]");
    });

    it("imprimir coleção enorme não explode", () => {
        setPrintLimits({ length: 10 });
        const inicio = Date.now();
        const saida = runSource("(pr-str (range 500000))");
        const decorrido = Date.now() - inicio;

        assert.match(saida, /^\(0 1 2 3 4 5 6 7 8 9 \.\.\.\)$/);
        assert.ok(decorrido < 3000, `deveria ser rápido, levou ${decorrido}ms`);
    });

    it("print-level corta a coleção inteira, não os escalares", () => {
        setPrintLimits({ level: 2 });
        // Como em Clojure: {:a {:b {:c 1}}} com nível 2 vira {:a {:b #}}.
        assert.strictEqual(
            runSource("(pr-str {:a {:b {:c 1}}})"),
            "{:a {:b #}}",
        );
        assert.strictEqual(runSource("(pr-str [1 [2 [3]]])"), "[1 [2 #]]");
    });

    it("os limites são ajustáveis de dentro da linguagem", () => {
        assert.strictEqual(
            runSource("(do (set-print-length! 2) (pr-str [1 2 3 4]))"),
            "[1 2 ...]",
        );
        assert.strictEqual(
            runSource("(do (set-print-length! nil) (pr-str [1 2 3 4]))"),
            "[1 2 3 4]",
        );
    });

    it("print-limits devolve os valores em vigor", () => {
        // Consulta por chave: a ordem de iteração do HAMT é derivada do hash,
        // não da inserção, e não é uma propriedade que valha assertar.
        assert.strictEqual(
            runSource("(do (set-print-length! 7) (:length (print-limits)))"),
            7,
        );
        assert.strictEqual(runSource("(:level (print-limits))"), null);
    });

    it("recusa valores inválidos", () => {
        assert.match(
            erroDe(() => runSource("(set-print-length! -1)")),
            /não negativo ou nil/,
        );
    });
});

describe("Limites — tempo de execução (#30)", () => {
    afterEach(semLimites);

    it("interrompe recursão sem caso base", () => {
        const inicio = Date.now();
        const mensagem = erroDe(() =>
            runSource("(defn laco [n] (laco (+ n 1))) (laco 0)", {
                timeoutMs: 250,
            }),
        );
        const decorrido = Date.now() - inicio;

        assert.match(mensagem, /passou do limite de 250 ms/);
        assert.ok(
            decorrido < 4000,
            `deveria parar perto de 250ms, levou ${decorrido}ms`,
        );
    });

    it("a mensagem diz o motivo provável e como ajustar", () => {
        const mensagem = erroDe(() =>
            runSource("(defn laco [n] (laco n)) (laco 0)", { timeoutMs: 150 }),
        );
        assert.match(mensagem, /laço que não termina/);
        assert.match(mensagem, /--timeout/);
    });

    it("programa rápido termina normalmente dentro do limite", () => {
        assert.strictEqual(
            runSource("(reduce + (range 100))", { timeoutMs: 5000 }),
            4950,
        );
    });

    it("sem timeout, nada é interrompido", () => {
        assert.strictEqual(runSource("(reduce + (range 10000))"), 49995000);
    });

    it("o limite é liberado depois da execução", () => {
        erroDe(() =>
            runSource("(defn laco [n] (laco n)) (laco 0)", { timeoutMs: 120 }),
        );
        // Sem a liberação, esta chamada herdaria o deadline já vencido.
        assert.strictEqual(runSource("(+ 1 2)"), 3);
    });
});
