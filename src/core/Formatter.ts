import { tokenize } from "./Tokenizer.js";
import type { Token } from "../types/index.js";
import { ClojureError } from "../errors/ClojureError.js";

/**
 * Formatador de código-fonte `.clj`.
 *
 * Diferente do `Parser`, este leitor produz uma árvore **concreta**: guarda
 * comentários e linhas em branco, que o parser normal descarta. Sem isso,
 * formatar um arquivo apagaria todos os comentários dele.
 *
 * Duas propriedades são garantidas por teste:
 *
 * - **Não muda o programa:** `parse(format(x))` é igual a `parse(x)`.
 * - **Idempotente:** `format(format(x))` é igual a `format(x)`.
 */

export interface FormatOptions {
    /** Largura alvo em colunas. Padrão: 80. */
    width?: number;
    /** Espaços por nível de indentação de corpo. Padrão: 2. */
    indent?: number;
}

const LARGURA_PADRAO = 80;
const RECUO_PADRAO = 2;

/**
 * Formas cujo **corpo** é indentado de forma fixa, e quantos argumentos ficam
 * na primeira linha junto do operador.
 *
 * `(defn nome [args]` fica na primeira linha (2 argumentos), e o corpo desce
 * indentado. Formas fora desta tabela são chamadas comuns: os argumentos
 * alinham sob o primeiro.
 */
const FORMAS_COM_CORPO = new Map<string, number>([
    ["defn", 2],
    ["defmacro", 2],
    ["fn", 1],
    ["let", 1],
    ["when", 1],
    ["when-not", 1],
    ["if", 1],
    ["def", 1],
    ["do", 0],
    ["try", 0],
    ["catch", 1],
    ["cond", 0],
    ["->", 1],
    ["->>", 1],
]);

type No =
    | { tipo: "atomo"; texto: string; linha: number }
    | { tipo: "comentario"; texto: string; linha: number; proprio: boolean }
    | {
          tipo: "colecao";
          abre: string;
          fecha: string;
          filhos: No[];
          linha: number;
      }
    | { tipo: "prefixo"; marca: string; alvo: No; linha: number };

const PREFIXOS: Record<string, string> = {
    "'": "'",
    "`": "`",
    "~": "~",
    "~@": "~@",
    "@": "@",
};

const FECHAMENTOS: Record<string, string> = { "(": ")", "[": "]", "{": "}" };

class Leitor {
    private pos = 0;

    constructor(private tokens: Token[]) {}

    private atual(): Token | undefined {
        return this.tokens[this.pos];
    }

    /** Lê todas as formas de nível superior. */
    lerTudo(): No[] {
        const nos: No[] = [];
        while (this.pos < this.tokens.length) {
            nos.push(this.lerNo());
        }
        return nos;
    }

    private lerNo(): No {
        const token = this.tokens[this.pos];
        if (token === undefined) {
            throw new ClojureError("Fim inesperado da entrada");
        }
        this.pos++;

        const linha = token.loc.start.line;

        if (token.type === "comment") {
            // Próprio da linha, ou pendurado no fim de uma linha de código?
            const anterior = this.tokens[this.pos - 2];
            const proprio =
                anterior === undefined || anterior.loc.start.line !== linha;
            return { tipo: "comentario", texto: token.value, linha, proprio };
        }

        const fecha = FECHAMENTOS[token.value];
        if (fecha !== undefined) {
            const filhos: No[] = [];
            while (
                this.pos < this.tokens.length &&
                this.atual()!.value !== fecha
            ) {
                filhos.push(this.lerNo());
            }
            if (this.pos >= this.tokens.length) {
                throw new ClojureError(
                    `Delimitador '${token.value}' não fechado`,
                    token.loc,
                );
            }
            this.pos++;
            return { tipo: "colecao", abre: token.value, fecha, filhos, linha };
        }

        const prefixo = PREFIXOS[token.value];
        if (prefixo !== undefined) {
            return {
                tipo: "prefixo",
                marca: prefixo,
                alvo: this.lerNo(),
                linha,
            };
        }

        return { tipo: "atomo", texto: token.value, linha };
    }
}

class Impressor {
    constructor(
        private width: number,
        private indent: number,
    ) {}

    /** Nome do operador, quando a coleção é uma lista começando por símbolo. */
    private operador(no: No): string | null {
        if (no.tipo !== "colecao" || no.abre !== "(") return null;
        const primeiro = no.filhos[0];
        return primeiro?.tipo === "atomo" ? primeiro.texto : null;
    }

    /** Renderiza numa linha só, ou `null` se houver comentário no caminho. */
    private plano(no: No): string | null {
        switch (no.tipo) {
            case "atomo":
                return no.texto;
            case "comentario":
                // Comentário força quebra: colar código depois dele numa
                // linha só comentaria o código.
                return null;
            case "prefixo": {
                const alvo = this.plano(no.alvo);
                return alvo === null ? null : no.marca + alvo;
            }
            case "colecao": {
                const partes: string[] = [];
                for (const filho of no.filhos) {
                    const parte = this.plano(filho);
                    if (parte === null) return null;
                    partes.push(parte);
                }
                return no.abre + partes.join(" ") + no.fecha;
            }
        }
    }

    /**
     * Renderiza um nó a partir de uma coluna.
     *
     * @param {No} no O nó.
     * @param {number} coluna Coluna em que o nó começa.
     * @return {string} O texto, possivelmente com quebras.
     */
    imprimir(no: No, coluna: number): string {
        const plano = this.plano(no);
        if (plano !== null && coluna + plano.length <= this.width) {
            return plano;
        }

        if (no.tipo === "prefixo") {
            return no.marca + this.imprimir(no.alvo, coluna + no.marca.length);
        }

        // Comentário nunca tem forma "plana"; sem este caso, um comentário de
        // nível superior era renderizado como string vazia — ou seja, sumia.
        if (no.tipo === "comentario") return no.texto;

        if (no.tipo !== "colecao") return plano ?? "";

        const op = this.operador(no);
        const naPrimeiraLinha =
            op !== null ? FORMAS_COM_CORPO.get(op) : undefined;

        if (naPrimeiraLinha !== undefined) {
            return this.imprimirCorpo(no, coluna, naPrimeiraLinha);
        }

        return this.imprimirAlinhado(no, coluna);
    }

    /** `(defn nome [args]` na primeira linha, corpo indentado. */
    private imprimirCorpo(
        no: No & { tipo: "colecao" },
        coluna: number,
        naPrimeiraLinha: number,
    ): string {
        const recuoCorpo = coluna + this.indent;
        const cabeca: string[] = [];
        const corpo: No[] = [];

        let restantes = naPrimeiraLinha;
        for (let i = 0; i < no.filhos.length; i++) {
            const filho = no.filhos[i]!;
            // O operador não conta na cota.
            if (i === 0 || (restantes > 0 && filho.tipo !== "comentario")) {
                if (i > 0) restantes--;
                cabeca.push(filho as any);
                continue;
            }
            corpo.push(filho);
        }

        let coluna_atual = coluna + no.abre.length;
        const partes: string[] = [];
        for (const filho of cabeca as unknown as No[]) {
            const texto = this.imprimir(filho, coluna_atual);
            partes.push(texto);
            const ultima = texto.slice(texto.lastIndexOf("\n") + 1);
            coluna_atual = texto.includes("\n")
                ? ultima.length + 1
                : coluna_atual + texto.length + 1;
        }
        const cabecaTexto = partes.join(" ");

        const linhas = this.linhasDeFilhos(corpo, recuoCorpo);
        const sufixo =
            linhas.length === 0
                ? ""
                : `\n${" ".repeat(recuoCorpo)}${linhas.join(`\n${" ".repeat(recuoCorpo)}`)}`;

        return `${no.abre}${cabecaTexto}${sufixo}${no.fecha}`;
    }

    /** Argumentos alinhados sob o primeiro. */
    private imprimirAlinhado(
        no: No & { tipo: "colecao" },
        coluna: number,
    ): string {
        const recuo = coluna + no.abre.length;
        const linhas =
            no.abre === "{"
                ? this.linhasDeMapa(no.filhos, recuo)
                : this.linhasDeFilhos(no.filhos, recuo);
        return `${no.abre}${linhas.join(`\n${" ".repeat(recuo)}`)}${no.fecha}`;
    }

    /**
     * Num mapa, cada linha é um par chave/valor — quebrar entre a chave e o
     * valor deixaria o mapa ilegível.
     */
    private linhasDeMapa(filhos: No[], recuo: number): string[] {
        const linhas: string[] = [];
        let i = 0;

        while (i < filhos.length) {
            const chave = filhos[i]!;

            if (chave.tipo === "comentario") {
                if (!chave.proprio && linhas.length > 0) {
                    linhas[linhas.length - 1] += ` ${chave.texto}`;
                } else {
                    linhas.push(chave.texto);
                }
                i++;
                continue;
            }

            const chaveTexto = this.imprimir(chave, recuo);
            const valor = filhos[i + 1];
            if (valor === undefined || valor.tipo === "comentario") {
                linhas.push(chaveTexto);
                i++;
                continue;
            }

            const valorTexto = this.imprimir(
                valor,
                recuo + chaveTexto.length + 1,
            );
            linhas.push(`${chaveTexto} ${valorTexto}`);
            i += 2;
        }

        return linhas;
    }

    /**
     * Converte filhos em linhas, juntando comentário de fim de linha ao nó
     * que o precede.
     */
    private linhasDeFilhos(filhos: No[], recuo: number): string[] {
        const linhas: string[] = [];

        for (const filho of filhos) {
            if (filho.tipo === "comentario" && !filho.proprio) {
                // Comentário pendurado: cola no fim da linha anterior.
                if (linhas.length > 0) {
                    linhas[linhas.length - 1] += ` ${filho.texto}`;
                    continue;
                }
            }
            if (filho.tipo === "comentario") {
                linhas.push(filho.texto);
                continue;
            }
            linhas.push(this.imprimir(filho, recuo));
        }

        return linhas;
    }
}

/**
 * Formata código-fonte Mini-Clojure.
 *
 * @param {string} source O fonte original.
 * @param {FormatOptions} [opts] Largura e recuo.
 * @return {string} O fonte formatado, terminando em nova linha.
 */
export function format(source: string, opts: FormatOptions = {}): string {
    const width = opts.width ?? LARGURA_PADRAO;
    const indent = opts.indent ?? RECUO_PADRAO;

    const tokens = tokenize(source, "formatter", { keepComments: true });
    const nos = new Leitor(tokens).lerTudo();
    const impressor = new Impressor(width, indent);

    const saida: string[] = [];
    let linhaAnterior: number | null = null;

    for (const no of nos) {
        // Preserva no máximo uma linha em branco entre formas de topo.
        if (linhaAnterior !== null && no.linha - linhaAnterior > 1) {
            saida.push("");
        }

        if (no.tipo === "comentario" && !no.proprio && saida.length > 0) {
            saida[saida.length - 1] += ` ${no.texto}`;
        } else {
            saida.push(impressor.imprimir(no, 0));
        }

        linhaAnterior = ultimaLinha(no);
    }

    return (
        saida
            .join("\n")
            .replace(/\n{3,}/g, "\n\n")
            .trimEnd() + "\n"
    );
}

/** Última linha ocupada por um nó no fonte original. */
function ultimaLinha(no: No): number {
    if (no.tipo === "colecao") {
        const ultimo = no.filhos[no.filhos.length - 1];
        return ultimo === undefined ? no.linha : ultimaLinha(ultimo);
    }
    if (no.tipo === "prefixo") return ultimaLinha(no.alvo);
    return no.linha;
}
