import { describe, it } from "node:test";
import assert from "node:assert";
import { runSource } from "../../src/index.js";

function erroDe(fn: () => unknown): string {
    try {
        fn();
        return "";
    } catch (e: any) {
        return e.message;
    }
}

describe("Transdutores — aridade sem coleção (#34)", () => {
    it("map, filter e remove devolvem transdutor", () => {
        assert.strictEqual(runSource("(fn? (map inc))"), true);
        assert.strictEqual(runSource("(fn? (filter even?))"), true);
        assert.strictEqual(runSource("(fn? (remove even?))"), true);
    });

    it("take, drop e as variantes -while também", () => {
        assert.strictEqual(runSource("(fn? (take 3))"), true);
        assert.strictEqual(runSource("(fn? (drop 3))"), true);
        assert.strictEqual(runSource("(fn? (take-while even?))"), true);
        assert.strictEqual(runSource("(fn? (drop-while even?))"), true);
    });

    it("com coleção, o comportamento de sequência continua igual", () => {
        assert.strictEqual(runSource("(pr-str (map inc [1 2 3]))"), "(2 3 4)");
        assert.strictEqual(
            runSource("(pr-str (filter even? [1 2 3 4]))"),
            "(2 4)",
        );
        assert.strictEqual(runSource("(pr-str (take 2 [1 2 3]))"), "(1 2)");
    });
});

describe("Transdutores — transduce (#34)", () => {
    it("reduz aplicando o transdutor", () => {
        assert.strictEqual(
            runSource("(transduce (map inc) + 0 (range 5))"),
            15,
        );
        assert.strictEqual(
            runSource("(transduce (filter even?) + 0 (range 10))"),
            20,
        );
    });

    it("sem valor inicial, usa a aridade 0 da função", () => {
        assert.strictEqual(runSource("(transduce (map inc) + (range 5))"), 15);
    });

    it("comp encadeia na ordem em que os dados fluem", () => {
        // (comp (map inc) (filter even?)) aplica map ANTES de filter.
        assert.strictEqual(
            runSource(
                "(transduce (comp (map inc) (filter even?)) + 0 (range 10))",
            ),
            30,
        );
        // Invertendo a ordem, o resultado muda.
        assert.strictEqual(
            runSource(
                "(transduce (comp (filter even?) (map inc)) + 0 (range 10))",
            ),
            25,
        );
    });

    it("recusa algo que não é transdutor", () => {
        assert.match(
            erroDe(() => runSource("(transduce 42 + 0 [1])")),
            /espera um transdutor/,
        );
    });
});

describe("Transdutores — into com transdutor (#34)", () => {
    it("constrói a coleção aplicando o transdutor", () => {
        assert.strictEqual(
            runSource("(pr-str (into [] (map inc) (range 4)))"),
            "[1 2 3 4]",
        );
        assert.strictEqual(
            runSource(
                "(pr-str (into [] (comp (map inc) (filter even?)) (range 10)))",
            ),
            "[2 4 6 8 10]",
        );
    });

    it("preserva o tipo do destino", () => {
        assert.strictEqual(
            runSource("(pr-str (into {} (map identity) [[:a 1] [:b 2]]))"),
            runSource("(pr-str {:a 1 :b 2})"),
        );
    });

    it("into com dois argumentos continua funcionando", () => {
        assert.strictEqual(runSource("(pr-str (into [1] [2 3]))"), "[1 2 3]");
    });

    it("recusa três argumentos sem transdutor no meio", () => {
        assert.match(
            erroDe(() => runSource("(into [] 42 [1])")),
            /transdutor no meio/,
        );
    });
});

describe("Transdutores — sequence (#34)", () => {
    it("aplica o transdutor preguiçosamente", () => {
        assert.strictEqual(
            runSource("(pr-str (into [] (sequence (map inc) (range 4))))"),
            "[1 2 3 4]",
        );
    });

    it("funciona sobre sequência infinita", () => {
        assert.strictEqual(
            runSource(
                "(pr-str (take 3 (sequence (map (fn [x] (* x x))) (range))))",
            ),
            "(0 1 4)",
        );
    });

    it("um transdutor com take termina sozinho", () => {
        assert.strictEqual(
            runSource("(pr-str (into [] (sequence (take 3) (range))))"),
            "[0 1 2]",
        );
    });
});

describe("Transdutores — terminação antecipada (#34)", () => {
    it("take como transdutor termina sobre sequência infinita", () => {
        assert.strictEqual(
            runSource(
                "(pr-str (into [] (comp (filter odd?) (take 4)) (range)))",
            ),
            "[1 3 5 7]",
        );
    });

    it("take-while como transdutor termina sobre infinita", () => {
        assert.strictEqual(
            runSource(
                "(pr-str (into [] (take-while (fn [x] (< x 5))) (range)))",
            ),
            "[0 1 2 3 4]",
        );
    });

    it("reduced para a redução", () => {
        assert.strictEqual(
            runSource(
                "(reduce (fn [acc x] (if (> x 3) (reduced acc) (+ acc x))) 0 (range 100))",
            ),
            6,
        );
    });

    it("reduced funciona sobre sequência infinita", () => {
        assert.strictEqual(
            runSource(
                "(reduce (fn [acc x] (if (> x 3) (reduced acc) (+ acc x))) 0 (range))",
            ),
            6,
        );
    });

    it("reduced?, reduced e unreduced", () => {
        assert.strictEqual(runSource("(reduced? (reduced 1))"), true);
        assert.strictEqual(runSource("(reduced? 1)"), false);
        assert.strictEqual(runSource("(unreduced (reduced 7))"), 7);
        assert.strictEqual(runSource("(unreduced 7)"), 7);
    });
});

describe("Transdutores — estado não vaza entre usos (#34)", () => {
    it("o mesmo transdutor com take pode ser reusado", () => {
        // O estado mora na closure criada a cada aplicação a um rf.
        assert.strictEqual(
            runSource(`
                (def pegar2 (take 2))
                (pr-str [(into [] pegar2 (range 5)) (into [] pegar2 (range 5))])
            `),
            "[[0 1] [0 1]]",
        );
    });

    it("o mesmo transdutor com drop-while pode ser reusado", () => {
        assert.strictEqual(
            runSource(`
                (def pular (drop-while (fn [x] (< x 3))))
                (pr-str [(into [] pular (range 6)) (into [] pular (range 6))])
            `),
            "[[3 4 5] [3 4 5]]",
        );
    });
});

describe("Transdutores — consumo em blocos (#34)", () => {
    it("uma redução que termina cedo pode produzir até um bloco a mais", () => {
        // Mesmo compromisso das seqs chunked de Clojure: consumir em blocos
        // de 32 é bem mais rápido, e o preço é over-produzir até 31 itens.
        const produzidos = runSource(`
            (def contador (atom 0))
            (def fonte (map (fn [x] (do (swap! contador inc) x)) (range 1000)))
            (reduce (fn [acc x] (if (> x 2) (reduced acc) (+ acc x))) 0 fonte)
            @contador
        `) as number;

        assert.ok(produzidos >= 4, "precisa ter produzido ao menos até parar");
        assert.ok(
            produzidos <= 32,
            `não deveria passar de um bloco; produziu ${produzidos}`,
        );
    });
});
