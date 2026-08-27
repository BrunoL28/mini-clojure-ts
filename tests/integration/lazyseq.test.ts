import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import { runSource } from "../../src/index.js";
import { setPrintLimits, clearTimeLimit } from "../../src/core/Limits.js";
import { LazySeq, lazy, FIM } from "../../src/core/LazySeq.js";

function reset() {
    setPrintLimits({ length: null, level: null, width: 80 });
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

describe("Lazy seqs — construtores preguiçosos (#33)", () => {
    afterEach(reset);

    it("range sem argumento é infinito", () => {
        assert.strictEqual(
            runSource("(pr-str (take 5 (range)))"),
            "(0 1 2 3 4)",
        );
    });

    it("range com argumentos continua igual", () => {
        assert.strictEqual(runSource("(pr-str (range 5))"), "(0 1 2 3 4)");
        assert.strictEqual(runSource("(pr-str (range 2 8 2))"), "(2 4 6)");
        assert.strictEqual(runSource("(pr-str (range 3 0 -1))"), "(3 2 1)");
    });

    it("repeat aceita as duas aridades", () => {
        assert.strictEqual(runSource("(pr-str (repeat 3 :x))"), "(:x :x :x)");
        assert.strictEqual(
            runSource("(pr-str (take 4 (repeat :x)))"),
            "(:x :x :x :x)",
        );
    });

    it("iterate produz a sequência das aplicações sucessivas", () => {
        assert.strictEqual(
            runSource("(pr-str (take 5 (iterate (fn [x] (* x 2)) 1)))"),
            "(1 2 4 8 16)",
        );
    });

    it("cycle repete a coleção", () => {
        assert.strictEqual(
            runSource("(pr-str (take 5 (cycle [:a :b])))"),
            "(:a :b :a :b :a)",
        );
        assert.strictEqual(runSource("(pr-str (take 3 (cycle [])))"), "()");
    });
});

describe("Lazy seqs — transformações sobre infinitas (#33)", () => {
    afterEach(reset);

    it("map não realiza a entrada", () => {
        assert.strictEqual(
            runSource("(pr-str (take 5 (map (fn [x] (* x x)) (range))))"),
            "(0 1 4 9 16)",
        );
    });

    it("filter não realiza a entrada", () => {
        assert.strictEqual(
            runSource("(pr-str (take 4 (filter even? (range))))"),
            "(0 2 4 6)",
        );
    });

    it("remove, drop e take encadeiam sobre infinita", () => {
        assert.strictEqual(
            runSource("(pr-str (take 3 (remove even? (range))))"),
            "(1 3 5)",
        );
        assert.strictEqual(
            runSource("(pr-str (take 3 (drop 100 (range))))"),
            "(100 101 102)",
        );
    });

    it("take-while termina sozinho sobre infinita", () => {
        assert.strictEqual(
            runSource(
                "(pr-str (take-while (fn [x] (< x 20)) (iterate (fn [x] (* x 3)) 1)))",
            ),
            "(1 3 9)",
        );
    });

    it("drop-while descarta o prefixo", () => {
        assert.strictEqual(
            runSource(
                "(pr-str (take 3 (drop-while (fn [x] (< x 10)) (range))))",
            ),
            "(10 11 12)",
        );
    });

    it("pipeline longo continua preguiçoso", () => {
        assert.strictEqual(
            runSource(
                "(pr-str (take 3 (map inc (filter even? (map (fn [x] (* x 3)) (range))))))",
            ),
            "(1 7 13)",
        );
    });
});

describe("Lazy seqs — integração com o resto da linguagem (#33)", () => {
    afterEach(reset);

    it("igualdade realiza os dois lados", () => {
        assert.strictEqual(
            runSource("(= (list 1 2 3) (map inc (range 3)))"),
            true,
        );
        assert.strictEqual(runSource("(= (map inc [0 1]) [1 2])"), true);
    });

    it("count realiza", () => {
        assert.strictEqual(runSource("(count (map inc (range 100)))"), 100);
    });

    it("os predicados classificam como lista", () => {
        assert.strictEqual(runSource("(seq? (map inc [1]))"), true);
        assert.strictEqual(runSource("(list? (map inc [1]))"), true);
        assert.strictEqual(runSource("(vector? (map inc [1]))"), false);
        assert.strictEqual(runSource("(coll? (range 3))"), true);
    });

    it("first, rest e nth funcionam", () => {
        assert.strictEqual(runSource("(first (range))"), 0);
        assert.strictEqual(
            runSource("(pr-str (take 2 (rest (range))))"),
            "(1 2)",
        );
        assert.strictEqual(runSource("(nth (map inc (range 10)) 5)"), 6);
    });

    it("destructuring realiza", () => {
        assert.strictEqual(runSource("(let [[a b] (range 5)] (+ a b))"), 1);
        assert.strictEqual(
            runSource("(pr-str (let [[a & r] (range 4)] r))"),
            "[1 2 3]",
        );
    });

    it("reduce e into realizam", () => {
        assert.strictEqual(runSource("(reduce + 0 (map inc (range 5)))"), 15);
        assert.strictEqual(
            runSource("(pr-str (into [] (range 4)))"),
            "[0 1 2 3]",
        );
    });

    it("serve como chave de mapa (hash realiza)", () => {
        // A chave é uma sequência preguiçosa; a busca usa uma lista comum.
        // Comparar por `pr-str`: duas keywords iguais são instâncias
        // distintas, e `strictEqual` compararia referência.
        assert.strictEqual(
            runSource(
                "(pr-str (get (assoc {} (map inc (range 2)) :ok) (list 1 2)))",
            ),
            ":ok",
        );
    });

    it("first e second produzem só o necessário", () => {
        // Sem isto, `(first (range))` travaria realizando o infinito.
        assert.strictEqual(runSource("(first (range))"), 0);
        assert.strictEqual(runSource("(second (range))"), 1);
    });

    it("rest continua preguiçoso", () => {
        assert.strictEqual(
            runSource("(pr-str (take 2 (rest (range))))"),
            "(1 2)",
        );
    });

    it("empty? decide com no máximo um elemento", () => {
        assert.strictEqual(runSource("(empty? (range))"), false);
        assert.strictEqual(runSource("(empty? (range 0))"), true);
    });

    it("nth produz só até o índice pedido", () => {
        assert.strictEqual(runSource("(nth (map inc (range)) 5)"), 6);
    });

    it("seq de infinita devolve a própria sequência", () => {
        assert.strictEqual(
            runSource("(pr-str (take 2 (seq (range))))"),
            "(0 1)",
        );
        assert.strictEqual(runSource("(seq (range 0))"), null);
    });

    it("unquote-splicing aceita sequência preguiçosa", () => {
        assert.strictEqual(
            runSource("(pr-str `(a ~@(range 3) b))"),
            "(a 0 1 2 b)",
        );
    });
});

describe("Lazy seqs — impressão (#33)", () => {
    afterEach(reset);

    it("imprime sequência infinita com print-length", () => {
        setPrintLimits({ length: 5 });
        assert.strictEqual(runSource("(pr-str (range))"), "(0 1 2 3 4 ...)");
        assert.strictEqual(
            runSource("(pr-str (iterate inc 0))"),
            "(0 1 2 3 4 ...)",
        );
    });

    it("pprint também respeita o limite em infinita", () => {
        setPrintLimits({ length: 4 });
        assert.strictEqual(runSource("(pprint-str (range))"), "(0 1 2 3 ...)");
    });

    it("sem limite, sequência finita imprime inteira", () => {
        assert.strictEqual(runSource("(pr-str (range 6))"), "(0 1 2 3 4 5)");
    });
});

describe("Lazy seqs — memoização e limites (#33)", () => {
    afterEach(reset);

    it("percorrer duas vezes não recalcula", () => {
        // O contador só sobe uma vez por elemento produzido.
        assert.strictEqual(
            runSource(`
                (def chamadas (atom 0))
                (def xs (map (fn [x] (do (swap! chamadas inc) x)) (range 5)))
                (count xs)
                (count xs)
                @chamadas
            `),
            5,
        );
    });

    it("--timeout interrompe a realização de uma infinita", () => {
        const inicio = Date.now();
        assert.match(
            erroDe(() => runSource("(count (range))", { timeoutMs: 250 })),
            /passou do limite de 250 ms/,
        );
        assert.ok(
            Date.now() - inicio < 5000,
            "deveria parar perto do limite pedido",
        );
    });
});

describe("Lazy seqs — API interna (#33)", () => {
    it("a sentinela de fim não colide com valores do usuário", () => {
        // nil, false e undefined são valores legítimos numa sequência.
        const seq = lazy(() => {
            const valores = [null, false, undefined, 0, ""];
            let i = 0;
            return () => (i < valores.length ? valores[i++] : FIM);
        });
        assert.deepStrictEqual(seq.realizar(), [null, false, undefined, 0, ""]);
    });

    it("primeiros() não produz além do pedido", () => {
        let produzidos = 0;
        const seq = new LazySeq(() => () => {
            produzidos++;
            return produzidos;
        });
        assert.deepStrictEqual(seq.primeiros(3), [1, 2, 3]);
        assert.strictEqual(produzidos, 3);
    });

    it("cursores independentes compartilham o cache", () => {
        let produzidos = 0;
        const seq = new LazySeq(() => {
            let i = 0;
            return () => {
                if (i >= 3) return FIM;
                produzidos++;
                return i++;
            };
        });

        assert.deepStrictEqual([...seq], [0, 1, 2]);
        assert.deepStrictEqual([...seq], [0, 1, 2]);
        assert.strictEqual(produzidos, 3, "não deveria recalcular");
    });
});
