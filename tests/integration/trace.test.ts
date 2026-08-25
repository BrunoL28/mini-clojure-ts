import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import { runSource } from "../../src/index.js";
import {
    startTracing,
    stopTracing,
    printProfile,
    isTracing,
} from "../../src/core/Trace.js";
import type { TraceOptions } from "../../src/core/Trace.js";

/** Remove os códigos de cor ANSI, para as asserções ficarem legíveis. */
function semCor(texto: string): string {
    return texto.replace(
        new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"),
        "",
    );
}

/** Roda com tracing ligado, capturando o stderr onde o trace sai. */
function comTrace(options: TraceOptions, codigo: string): string[] {
    const linhas: string[] = [];
    const original = console.error;
    console.error = (...args: any[]) =>
        linhas.push(args.map((a) => String(a)).join(" "));
    try {
        startTracing(options);
        runSource(codigo);
        printProfile();
    } finally {
        stopTracing();
        console.error = original;
    }
    return linhas.flatMap((l) => semCor(l).split("\n"));
}

describe("Observabilidade — desligado por padrão (#29)", () => {
    afterEach(stopTracing);

    it("não há tracing ativo sem pedir", () => {
        assert.strictEqual(isTracing(), false);
    });

    it("execução normal não escreve em stderr", () => {
        const linhas: string[] = [];
        const original = console.error;
        try {
            console.error = (...a: any[]) => linhas.push(a.join(" "));
            runSource("(reduce + (range 50))");
        } finally {
            console.error = original;
        }
        assert.deepStrictEqual(linhas, []);
    });
});

describe("Observabilidade — trace de avaliação (#29)", () => {
    afterEach(stopTracing);

    it("registra cada forma composta avaliada", () => {
        const linhas = comTrace({ evalForms: true }, "(+ 1 (* 2 3))");
        assert.ok(
            linhas.some((l) => l.includes("(+ 1 (* 2 3))")),
            "esperava a forma externa em:\n" + linhas.join("\n"),
        );
        assert.ok(linhas.some((l) => l.includes("(* 2 3)")));
    });

    it("indenta conforme o aninhamento", () => {
        const linhas = comTrace({ evalForms: true }, "(+ 1 (* 2 3))");
        const externa = linhas.find((l) => l.includes("(+ 1"))!;
        const interna = linhas.find(
            (l) => l.includes("(* 2 3)") && l !== externa,
        )!;
        assert.ok(
            interna.length > externa.length - 8,
            "a forma interna deveria vir indentada",
        );
        assert.ok(interna.startsWith("│"), "esperava recuo com barra");
    });

    it("respeita a profundidade máxima", () => {
        const codigo = "(+ 1 (* 2 (- 5 2)))";
        // Contar linhas, não procurar texto: a forma externa contém o texto
        // das internas, então `includes` daria falso positivo.
        const completo = comTrace({ evalForms: true }, codigo);
        const raso = comTrace({ evalForms: true, maxDepth: 1 }, codigo);

        assert.strictEqual(completo.length, 3, "três níveis aninhados");
        assert.strictEqual(raso.length, 1, "só o nível externo");
        assert.ok(!raso[0]!.startsWith("│"));
    });

    it("não altera o resultado do programa", () => {
        const original = console.error;
        try {
            console.error = () => {};
            startTracing({ evalForms: true });
            assert.strictEqual(runSource("(reduce + (range 10))"), 45);
        } finally {
            stopTracing();
            console.error = original;
        }
    });
});

describe("Observabilidade — trace de macroexpansão (#29)", () => {
    afterEach(stopTracing);

    it("registra a expansão de macro no uso normal", () => {
        const texto = comTrace(
            { macroexpand: true },
            "(defmacro dobro (x) `(* 2 ~x)) (dobro 21)",
        ).join("\n");

        assert.match(texto, /macro \(dobro 21\)/);
        assert.match(texto, /\(\* 2 21\)/);
    });

    it("não registra chamada de função comum", () => {
        assert.deepStrictEqual(comTrace({ macroexpand: true }, "(+ 1 2)"), []);
    });
});

describe("Observabilidade — profiler (#29)", () => {
    afterEach(stopTracing);

    it("conta formas e agrupa por operador", () => {
        const texto = comTrace(
            { profile: true },
            "(defn fib [n] (if (< n 2) n (+ (fib (- n 1)) (fib (- n 2))))) (fib 10)",
        ).join("\n");

        assert.match(texto, /formas avaliadas: /);
        assert.match(texto, /tempo total: /);
        assert.match(texto, /fib\s+\d/);
        assert.match(texto, /if\s+\d/);
    });

    it("o perfil sai em stderr, sem poluir a saída do programa", () => {
        const saida: string[] = [];
        const originalLog = console.log;
        const originalErr = console.error;
        try {
            console.log = (...a: any[]) => saida.push(a.join(" "));
            console.error = () => {};
            startTracing({ profile: true });
            runSource('(println "resultado")');
            printProfile();
        } finally {
            console.log = originalLog;
            console.error = originalErr;
            stopTracing();
        }
        assert.deepStrictEqual(saida, ["resultado"]);
    });
});
