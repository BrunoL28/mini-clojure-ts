import { describe, it } from "node:test";
import assert from "node:assert";
import { runSource, parse } from "../../src/index.js";
import { tokenize } from "../../src/core/Tokenizer.js";

function erroDe(fn: () => unknown): string {
    try {
        fn();
        return "";
    } catch (e: any) {
        return e.message;
    }
}

describe("Reader — ~@ é um token só (#32)", () => {
    it("tokeniza ~@ como um token, não ~ seguido de @", () => {
        assert.deepStrictEqual(
            tokenize("~@xs").map((t) => t.value),
            ["~@", "xs"],
        );
    });

    it("~ e @ sozinhos continuam separados", () => {
        assert.deepStrictEqual(
            tokenize("~x").map((t) => t.value),
            ["~", "x"],
        );
        assert.deepStrictEqual(
            tokenize("@x").map((t) => t.value),
            ["@", "x"],
        );
    });

    it("~@ vira (unquote-splicing x)", () => {
        const forma: any = parse("~@xs")[0];
        assert.strictEqual(forma[0].value, "unquote-splicing");
        assert.strictEqual(forma[1].value, "xs");
    });

    it("@ continua sendo deref", () => {
        assert.strictEqual(runSource("(let [a (atom 7)] @a)"), 7);
    });
});

describe("Quasiquote — unquote-splicing (#32)", () => {
    it("intercala numa lista", () => {
        assert.strictEqual(
            runSource("(def xs [1 2 3]) (pr-str `(a ~@xs b))"),
            "(a 1 2 3 b)",
        );
    });

    it("intercala num vetor, preservando o tipo", () => {
        assert.strictEqual(
            runSource("(def xs [1 2 3]) (pr-str `[0 ~@xs 4])"),
            "[0 1 2 3 4]",
        );
        assert.strictEqual(runSource("(def xs [1]) (vector? `[~@xs])"), true);
    });

    it("aceita vários splices na mesma forma", () => {
        assert.strictEqual(
            runSource("(def a [1 2]) (def b [3 4]) (pr-str `(~@a x ~@b))"),
            "(1 2 x 3 4)",
        );
    });

    it("splice de nil e de coleção vazia não insere nada", () => {
        assert.strictEqual(runSource("(pr-str `(a ~@nil b))"), "(a b)");
        assert.strictEqual(runSource("(pr-str `(a ~@[] b))"), "(a b)");
    });

    it("splice de mapa intercala os pares", () => {
        assert.strictEqual(runSource("(count `(~@{:a 1 :b 2}))"), 2);
    });

    it("recusa splice de valor não sequencial", () => {
        assert.match(
            erroDe(() => runSource("(pr-str `(a ~@42))")),
            /requer uma sequência/,
        );
    });

    it("recusa ~@ fora de uma sequência", () => {
        assert.match(
            erroDe(() => runSource("(def x [1]) `~@x")),
            /só pode aparecer dentro de uma sequência/,
        );
    });
});

describe("Quasiquote — dentro de mapas (#32)", () => {
    // `{:k ~x}` devolvia `{:k (unquote x)}`: mapas não eram percorridos.
    it("processa unquote no valor", () => {
        assert.strictEqual(runSource("(def x 9) (pr-str `{:k ~x})"), "{:k 9}");
    });

    it("processa unquote na chave", () => {
        assert.strictEqual(
            runSource("(def k :dinamica) (pr-str `{~k 1})"),
            "{:dinamica 1}",
        );
    });

    it("processa mapas aninhados", () => {
        assert.strictEqual(
            runSource("(def x 2) (pr-str `{:a {:b ~x}})"),
            "{:a {:b 2}}",
        );
    });
});

describe("defmacro — parâmetros variádicos (#32)", () => {
    // Os argumentos eram ligados por posição, sem passar pelo `bind`, então
    // `&` não funcionava — o que tornava `~@` quase inútil.
    it("suporta & rest", () => {
        assert.strictEqual(
            runSource(
                "(defmacro lista [& itens] `(vector ~@itens)) (pr-str (lista 1 2 3))",
            ),
            "[1 2 3]",
        );
    });

    it("suporta parâmetros fixos antes do &", () => {
        assert.strictEqual(
            runSource(
                "(defmacro quando [teste & corpo] `(if ~teste (do ~@corpo) nil)) (quando true 1 :fim)",
            ).toString(),
            ":fim",
        );
    });

    it("suporta destructuring nos argumentos", () => {
        assert.strictEqual(
            runSource("(defmacro primeiro [[a _]] `~a) (primeiro (7 8))"),
            7,
        );
    });

    it("aceita corpo com várias formas", () => {
        // Antes, as formas extras eram silenciosamente descartadas.
        assert.strictEqual(
            runSource("(defmacro m [x] (def visto x) `(+ ~x 1)) (m 41)"),
            42,
        );
    });

    it("params em lista continuam funcionando", () => {
        assert.strictEqual(
            runSource("(defmacro dobro (x) `(* 2 ~x)) (dobro 21)"),
            42,
        );
    });
});
