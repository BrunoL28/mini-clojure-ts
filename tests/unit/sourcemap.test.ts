import { describe, it } from "node:test";
import assert from "node:assert";
import { encodeVLQ, buildSourceMap } from "../../src/core/SourceMap.js";

describe("SourceMap — codificação VLQ", () => {
    it("codifica zero e positivos", () => {
        assert.strictEqual(encodeVLQ(0), "A");
        assert.strictEqual(encodeVLQ(1), "C");
        assert.strictEqual(encodeVLQ(2), "E");
    });

    it("codifica negativos usando o bit de sinal", () => {
        assert.strictEqual(encodeVLQ(-1), "D");
        assert.strictEqual(encodeVLQ(-2), "F");
    });

    it("usa continuação para valores acima de 15", () => {
        assert.strictEqual(encodeVLQ(16), "gB");
        assert.strictEqual(encodeVLQ(-16), "hB");
    });
});

describe("SourceMap — montagem do mapa v3", () => {
    const map = () =>
        JSON.parse(
            buildSourceMap({
                file: "saida.js",
                source: "entrada.clj",
                sourceContent: "(println 1)\n(println 2)\n",
                mappings: [
                    {
                        generatedLine: 2,
                        generatedColumn: 0,
                        sourceLine: 0,
                        sourceColumn: 0,
                    },
                    {
                        generatedLine: 3,
                        generatedColumn: 0,
                        sourceLine: 1,
                        sourceColumn: 0,
                    },
                ],
            }),
        );

    it("produz a estrutura v3 esperada", () => {
        const m = map();
        assert.strictEqual(m.version, 3);
        assert.strictEqual(m.file, "saida.js");
        assert.deepStrictEqual(m.sources, ["entrada.clj"]);
        assert.deepStrictEqual(m.names, []);
    });

    it("embute o conteúdo do fonte, deixando o mapa autocontido", () => {
        assert.match(map().sourcesContent[0], /println/);
    });

    it("pula as linhas sem mapeamento e usa deltas relativos", () => {
        // Duas linhas vazias no início, depois +0 e +1 na linha de origem.
        assert.strictEqual(map().mappings, ";;AAAA;AACA");
    });
});
