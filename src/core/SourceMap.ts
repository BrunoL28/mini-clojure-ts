/**
 * Geração de source maps v3 para o código compilado.
 *
 * O codegen emite **uma linha por forma de nível superior**, então o
 * mapeamento é feito nessa granularidade: cada linha do JavaScript aponta para
 * a linha/coluna da forma `.clj` que a originou. É o bastante para um stack
 * trace do Node apontar a forma certa no fonte original — que é o critério de
 * aceite da issue #23 ("ou pelo menos mapeia para forma próxima").
 */

const BASE64 =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Codifica um inteiro em VLQ base64 com sinal, como exige o formato v3.
 *
 * @param {number} value O valor a codificar.
 * @return {string} A representação VLQ base64.
 */
export function encodeVLQ(value: number): string {
    // Bit menos significativo carrega o sinal.
    let vlq = value < 0 ? (-value << 1) | 1 : value << 1;
    let out = "";

    do {
        let digit = vlq & 0b11111;
        vlq >>>= 5;
        // Bit de continuação.
        if (vlq > 0) digit |= 0b100000;
        out += BASE64[digit];
    } while (vlq > 0);

    return out;
}

export interface Mapping {
    /** Linha no JavaScript gerado (base 0). */
    generatedLine: number;
    /** Coluna no JavaScript gerado (base 0). */
    generatedColumn: number;
    /** Linha no `.clj` de origem (base 0). */
    sourceLine: number;
    /** Coluna no `.clj` de origem (base 0). */
    sourceColumn: number;
}

export interface SourceMapInput {
    /** Nome do arquivo gerado (campo `file`). */
    file: string;
    /** Caminho do fonte, relativo ao `.map`. */
    source: string;
    /** Conteúdo do fonte, embutido para o mapa ser autocontido. */
    sourceContent: string;
    mappings: Mapping[];
}

/**
 * Monta um source map v3 a partir das posições coletadas pelo codegen.
 *
 * @param {SourceMapInput} input Arquivo, fonte e mapeamentos.
 * @return {string} O JSON do source map.
 */
export function buildSourceMap(input: SourceMapInput): string {
    const ordered = [...input.mappings].sort(
        (a, b) =>
            a.generatedLine - b.generatedLine ||
            a.generatedColumn - b.generatedColumn,
    );

    // Os campos de fonte são deltas acumulados ao longo do arquivo inteiro;
    // só a coluna gerada reinicia a cada linha.
    let previousSourceLine = 0;
    let previousSourceColumn = 0;

    const lines: string[] = [];
    let currentLine = 0;
    let segments: string[] = [];
    let previousGeneratedColumn = 0;

    const flush = () => {
        lines.push(segments.join(","));
        segments = [];
        previousGeneratedColumn = 0;
    };

    for (const mapping of ordered) {
        while (currentLine < mapping.generatedLine) {
            flush();
            currentLine++;
        }

        segments.push(
            encodeVLQ(mapping.generatedColumn - previousGeneratedColumn) +
                // Índice do fonte: só há um, então o delta é sempre 0.
                encodeVLQ(0) +
                encodeVLQ(mapping.sourceLine - previousSourceLine) +
                encodeVLQ(mapping.sourceColumn - previousSourceColumn),
        );

        previousGeneratedColumn = mapping.generatedColumn;
        previousSourceLine = mapping.sourceLine;
        previousSourceColumn = mapping.sourceColumn;
    }
    flush();

    return JSON.stringify({
        version: 3,
        file: input.file,
        sources: [input.source],
        sourcesContent: [input.sourceContent],
        names: [],
        mappings: lines.join(";"),
    });
}
