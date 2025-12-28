import { test, describe, it } from "node:test";
import assert from "node:assert";
import { tokenize } from "../../src/core/Tokenizer.js";
import { ClojureError } from "../../src/errors/ClojureError.js";

describe("Tokenizer Unit Tests", () => {
    it("deve tokenizar expressões básicas", () => {
        const input = "(+ 1 2)";
        const tokens = tokenize(input);

        assert.strictEqual(tokens.length, 5); // (, +, 1, 2, )
        assert.strictEqual(tokens[1]!.value, "+");
        assert.strictEqual(tokens[2]!.value, "1");
    });

    it("deve ignorar comentários", () => {
        const input = "(print 1) ; isto é um comentário";
        const tokens = tokenize(input);

        // Esperado: (, print, 1, ) -> 4 tokens
        assert.strictEqual(tokens.length, 4);
        assert.strictEqual(tokens[1]!.value, "print");
    });

    it("deve rastrear localização (linha/coluna)", () => {
        const input = "\n  (def x 10)";
        const tokens = tokenize(input);

        // ( está na linha 2, coluna 3 (2 espaços antes)
        const openParen = tokens[0]!;
        assert.strictEqual(openParen.loc.start.line, 2);
        assert.strictEqual(openParen.loc.start.col, 3);
    });

    it("deve tratar strings corretamente", () => {
        const input = '(print "Ola Mundo")';
        const tokens = tokenize(input);
        const strToken = tokens[2]!;

        assert.strictEqual(strToken.value, '"Ola Mundo"');
    });

    it("ERRO: deve falhar em string não terminada (Regressão)", () => {
        const input = '(print "abc\n)';

        try {
            tokenize(input);
            assert.fail("Deveria ter lançado erro de string não terminada");
        } catch (e) {
            assert.ok(e instanceof ClojureError);
            assert.match(e.message, /String não terminada/);
        }
    });

    it("ERRO: deve falhar em string não terminada no fim do arquivo", () => {
        const input = '"abc';
        try {
            tokenize(input);
            assert.fail("Deveria ter lançado erro");
        } catch (e) {
            assert.ok(e instanceof ClojureError);
            assert.match(e.message, /String não terminada/);
        }
    });
});
