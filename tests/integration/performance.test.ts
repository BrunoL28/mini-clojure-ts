import { describe, it } from "node:test";
import assert from "node:assert";
import { runSource, createGlobalEnv } from "../../src/index.js";

/**
 * Regressões de desempenho e correção do R7 (#28).
 *
 * Os benchmarks de `pnpm bench` medem tendência; estes testes travam as
 * propriedades que não podem voltar a quebrar.
 */

function erroDe(fn: () => unknown): string {
    try {
        fn();
        return "";
    } catch (e: any) {
        return e.message;
    }
}

describe("Env — sem vazamento de Object.prototype (#28)", () => {
    // `vars` era um `{}`, então `"constructor" in vars` era verdadeiro pelo
    // protótipo e símbolos indefinidos resolviam para membros de
    // `Object.prototype` em vez de dar erro.
    for (const nome of [
        "constructor",
        "toString",
        "valueOf",
        "hasOwnProperty",
        "__proto__",
        "isPrototypeOf",
    ]) {
        it(`'${nome}' indefinido dá erro, não um objeto do host`, () => {
            assert.match(
                erroDe(() => runSource(nome)),
                new RegExp(
                    `Símbolo '${nome.replace("__", "__")}' não encontrado`,
                ),
            );
        });
    }

    it("ainda dá para definir um símbolo com esses nomes", () => {
        assert.strictEqual(runSource("(def constructor 42) constructor"), 42);
    });

    it("nil ligado é distinguido de não ligado", () => {
        const env = createGlobalEnv();
        runSource("(def vazio nil)", { env });
        assert.strictEqual(runSource("vazio", { env }), null);
        assert.match(
            erroDe(() => runSource("nunca-definido", { env })),
            /não encontrado/,
        );
    });
});

describe("Coleções — into e conj são lineares (#28)", () => {
    // `into` fazia um `conj` por item, e cada `conj` recriava o vetor inteiro:
    // O(n²). `(into [] (range 32000))` levava ~39 s.
    it("into de 50k elementos termina rápido", () => {
        // Limite absoluto, não comparação relativa entre tamanhos: os testes
        // rodam em paralelo e medir proporção de tempo de parede dá falso
        // positivo. A margem é enorme de propósito — quadrático em 50k levaria
        // mais de um minuto, então 5 s separa os dois casos sem ambiguidade.
        const inicio = Date.now();
        assert.strictEqual(runSource("(count (into [] (range 50000)))"), 50000);
        const decorrido = Date.now() - inicio;
        assert.ok(
            decorrido < 5000,
            `into deveria ser linear; levou ${decorrido}ms`,
        );
    });

    it("vetores grandes não estouram o limite de argumentos", () => {
        // `ClojureVector.of(...array)` espalhava o array como argumentos.
        assert.strictEqual(
            runSource("(count (conj (into [] (range 200000)) 1))"),
            200001,
        );
    });

    it("a semântica de conj e into não mudou", () => {
        assert.strictEqual(runSource("(pr-str (into [1] [2 3]))"), "[1 2 3]");
        assert.strictEqual(
            runSource("(pr-str (into (list 1) (list 2 3)))"),
            "(3 2 1)",
        );
        assert.strictEqual(runSource("(pr-str (conj [1] 2 3))"), "[1 2 3]");
        assert.strictEqual(
            runSource("(pr-str (conj (list 3) 2 1))"),
            "(1 2 3)",
        );
        assert.strictEqual(runSource("(pr-str (into {} [[:a 1]]))"), "{:a 1}");
        assert.strictEqual(runSource("(pr-str (into [] nil))"), "[]");
    });
});

describe("Destructuring — busca por chave sem varrer o mapa (#28)", () => {
    // As buscas caíam num laço O(n) sobre as entradas quando a chave faltava;
    // o HAMT já indexa keywords e símbolos por valor.
    it("chave ausente com :or usa o padrão", () => {
        assert.strictEqual(
            runSource("(let [{:keys [a] :or {a 9}} {:b 1}] a)"),
            9,
        );
    });

    it("chave ausente sem :or é nil", () => {
        assert.strictEqual(runSource("(let [{:keys [a]} {:b 1}] a)"), null);
    });

    it("renomeação continua funcionando", () => {
        assert.strictEqual(runSource("(let [{v :chave} {:chave 7}] v)"), 7);
    });

    it("keyword como função em mapa grande", () => {
        assert.strictEqual(
            runSource(
                "(let [m (into {} (map (fn [i] [i i]) (range 5000)))] (get m 4999))",
            ),
            4999,
        );
    });
});
