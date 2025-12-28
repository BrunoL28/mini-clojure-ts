import { describe, it } from "node:test";
import assert from "node:assert";
import { tokenize } from "../../src/core/Tokenizer.js";
import { parse } from "../../src/core/Parser.js";
import {
    ClojureVector,
    ClojureMap,
    ClojureKeyword,
    ClojureSymbol,
} from "../../src/types/index.js";

function parseOne(code: string) {
    return parse(tokenize(code));
}

describe("Parser Unit Tests", () => {
    it("deve parsear números e símbolos", () => {
        assert.strictEqual(parseOne("42"), 42);
        const sym = parseOne("x");
        assert.ok(sym instanceof ClojureSymbol);
        assert.strictEqual((sym as ClojureSymbol).value, "x");
    });

    it("deve parsear vetores []", () => {
        const ast = parseOne("[1 2 3]");
        assert.ok(ast instanceof ClojureVector);
        assert.strictEqual((ast as ClojureVector).length, 3);
    });

    it("deve parsear mapas {}", () => {
        const ast = parseOne("{:a 1 :b 2}");
        assert.ok(ast instanceof ClojureMap);
        assert.strictEqual((ast as ClojureMap).size, 2);
    });

    it("deve parsear reader macros (quote, quasiquote)", () => {
        // Teste do Quote (')
        const quoted = parseOne("'x");
        assert.ok(Array.isArray(quoted));
        // Cast para any[] para permitir acesso ao indice 0 sem erro de TS
        assert.strictEqual(
            ((quoted as any[])[0] as ClojureSymbol).value,
            "quote",
        );

        // Teste do Quasiquote (`)
        const quasi = parseOne("`x");
        assert.ok(Array.isArray(quasi), "Quasiquote deve retornar uma lista");
        // Correção do erro "Object is possibly null" e acesso indexado
        assert.strictEqual(
            ((quasi as any[])[0] as ClojureSymbol).value,
            "quasiquote",
        );
    });

    it("ERRO: deve detectar parênteses desbalanceados", () => {
        try {
            parseOne("(+ 1 2"); // Falta )
            assert.fail("Deveria falhar");
        } catch (e: any) {
            assert.match(e.message, /Lista desbalanceada/);
        }
    });

    it("ERRO: deve detectar mapas ímpares", () => {
        try {
            parseOne("{:a 1 :b}"); // Falta valor
            assert.fail("Deveria falhar");
        } catch (e: any) {
            assert.match(e.message, /Mapa desbalanceado/);
        }
    });
});
