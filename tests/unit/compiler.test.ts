import { describe, it } from "node:test";
import assert from "node:assert";
import { parse, compileSource } from "../../src/index.js";
import { transpile } from "../../src/core/Compiler.js";

/** Compila a primeira forma do fonte, sem preâmbulo. */
function js(source: string): string {
    const [first] = parse(source);
    return transpile(first!);
}

/** Programa completo, sem a linha de import. */
function program(source: string): string {
    return compileSource(source, { emitImport: false });
}

describe("Compiler — literais de string (regressão #38)", () => {
    it("emite string literal com aspas, não como identificador", () => {
        assert.strictEqual(js('(str "ola")'), 'str("ola")');
    });

    it("preserva hífens dentro da string", () => {
        assert.strictEqual(
            js('(str "--- Iniciando ---")'),
            'str("--- Iniciando ---")',
        );
    });

    it("preserva ? e ! dentro da string", () => {
        assert.strictEqual(
            js('(str "tudo certo? sim!")'),
            'str("tudo certo? sim!")',
        );
    });

    it("escapa aspas, barras e quebras de linha", () => {
        assert.strictEqual(js('(str "a\\"b")'), 'str("a\\"b")');
        assert.strictEqual(js('(str "a\\\\b")'), 'str("a\\\\b")');
        assert.strictEqual(js('(str "a\\nb")'), 'str("a\\nb")');
    });

    it("string vazia e string parecida com símbolo continuam strings", () => {
        assert.strictEqual(js('(str "")'), 'str("")');
        assert.strictEqual(js('(str "js/console")'), 'str("js/console")');
    });
});

describe("Compiler — identificadores", () => {
    it("aplica mangling em símbolos", () => {
        assert.strictEqual(js("(foo-bar 1)"), "foo_bar(1)");
        assert.strictEqual(js("(vazio? 1)"), "vazio$q(1)");
    });

    it("parâmetros de fn usam a mesma mangling do corpo", () => {
        assert.strictEqual(js("(fn [ok?] ok?)"), "((ok$q) => ok$q)");
        assert.strictEqual(js("(fn [a-b] a-b)"), "((a_b) => a_b)");
    });

    it("escapa nomes que são palavras reservadas do JavaScript", () => {
        // `throw` e `new` são nomes válidos no Mini-Clojure e reservados no JS.
        assert.match(
            program('(throw "x")'),
            /const \$throw = \$rt\.core\["throw"\]/,
        );
        assert.doesNotMatch(program('(throw "x")'), /const throw =/);
    });

    it("um def do usuário sombreia a stdlib sem declarar o nome duas vezes", () => {
        const out = program("(defn str [x] x) (str 1)");
        assert.doesNotMatch(out, /const str = /);
        assert.match(out, /let str;/);
    });
});

describe("Compiler — formas do núcleo", () => {
    it("if usa truthiness de Clojure, não a do JavaScript", () => {
        // 0 e "" são verdadeiros em Clojure.
        assert.strictEqual(js("(if x 1)"), "($rt.truthy(x) ? 1 : null)");
    });

    it('if sem ramo else emite null, não a string "null"', () => {
        assert.match(js("(if x 1)"), /: null\)$/);
    });

    it("keywords são internadas pelo runtime", () => {
        assert.strictEqual(js("(f :a)"), 'f($rt.kw(":a"))');
    });

    it("vetores e mapas passam pelos construtores do runtime", () => {
        assert.strictEqual(js("[1 2]"), "$rt.vec([1, 2])");
        assert.match(js("{:a 1}"), /^\$rt\.map\(\[/);
    });

    it("keyword na posição de função vira chamada genérica", () => {
        assert.strictEqual(js("(:k m)"), '$rt.call($rt.kw(":k"), m)');
    });

    it("def vira atribuição a um nome declarado no preâmbulo", () => {
        const out = program("(def x 1)");
        assert.match(out, /let x;/);
        assert.match(out, /\(x = 1\);/);
    });

    it("não emite globalThis (DoD do #20)", () => {
        const out = program("(def x 1) (defn f [n] (* n x)) (f 2)");
        assert.doesNotMatch(out, /globalThis/);
    });
});

describe("Compiler — formas não suportadas no compilado", () => {
    for (const form of [
        '(require "./m.clj")',
        '(load-file "./m.clj")',
        "(macroexpand (quote (f 1)))",
    ]) {
        it(`${form} falha com erro explícito`, () => {
            assert.throws(
                () => program(form),
                /não é suportado no código compilado/,
            );
        });
    }
});
