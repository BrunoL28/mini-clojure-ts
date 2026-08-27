import { ClojureVector, ClojureMap, ClojureAtom } from "../types/index.js";
import { prStr } from "./Printer.js";
import { getPrintLimits } from "./Limits.js";
import { LazySeq } from "./LazySeq.js";

/**
 * Impressão com quebra de linha e indentação.
 *
 * A regra é uma só: **cabe na largura, sai numa linha**. Só o que não cabe
 * quebra, e a quebra alinha os itens sob o primeiro, como no `pprint` de
 * Clojure. Isso mantém o formato compacto para dado pequeno e legível para
 * dado grande, sem duas representações concorrentes.
 */

export interface PrettyOptions {
    /** Largura alvo em colunas. Padrão: 80. */
    width?: number;
    /** Recuo já consumido na linha atual. Padrão: 0. */
    indent?: number;
}

const LARGURA_PADRAO = 80;

/** Reticências como item, respeitando o limite de impressão. */
function limitar<T>(itens: T[], limite: number | null): (T | "...")[] {
    if (limite === null || itens.length <= limite) return itens;
    return [...itens.slice(0, limite), "..."];
}

function ehVetor(data: any): boolean {
    return data instanceof ClojureVector;
}

/**
 * Empacota itens de linha única, quebrando só quando a próxima não caberia.
 *
 * @param {string[]} itens Os itens já formatados.
 * @param {number} indent Coluna em que os itens começam.
 * @param {number} width Largura alvo.
 * @return {string} Os itens separados por espaço ou quebra de linha.
 */
function preencher(itens: string[], indent: number, width: number): string {
    const recuo = " ".repeat(indent);
    let saida = "";
    let coluna = indent;

    for (let i = 0; i < itens.length; i++) {
        const item = itens[i]!;

        if (i === 0) {
            saida = item;
            coluna = indent + item.length;
            continue;
        }

        // +1 do espaço separador. No último item reserva mais uma coluna,
        // para o delimitador de fechamento não estourar a largura.
        const fechamento = i === itens.length - 1 ? 1 : 0;
        if (coluna + 1 + item.length + fechamento <= width) {
            saida += ` ${item}`;
            coluna += 1 + item.length;
        } else {
            saida += `\n${recuo}${item}`;
            coluna = indent + item.length;
        }
    }

    return saida;
}

function formatar(data: any, indent: number, width: number): string {
    // Realiza o necessário e formata como lista; o `prStr` acima já respeitou
    // o limite de impressão ao decidir o que produzir.
    if (data instanceof LazySeq) {
        const limite = getPrintLimits().length;
        const itens =
            limite === null ? data.realizar() : data.primeiros(limite + 1);
        return formatar(itens, indent, width);
    }

    const plano = prStr(data, true);

    // Cabe? Então não há o que decidir.
    if (indent + plano.length <= width) return plano;

    const limites = getPrintLimits();

    if (data instanceof ClojureMap) {
        const interno = indent + 1;
        const recuo = " ".repeat(interno);

        const entradas = limitar(data.entries(), limites.length).map(
            (entrada) => {
                if (entrada === "...") return "...";
                const [chave, valor] = entrada as [any, any];
                const chaveStr = prStr(chave, true);
                const valorStr = formatar(
                    valor,
                    interno + chaveStr.length + 1,
                    width,
                );
                return `${chaveStr} ${valorStr}`;
            },
        );

        return `{${entradas.join(`\n${recuo}`)}}`;
    }

    if (Array.isArray(data)) {
        const abre = ehVetor(data) ? "[" : "(";
        const fecha = ehVetor(data) ? "]" : ")";
        const interno = indent + 1;
        const recuo = " ".repeat(interno);

        const itens = limitar(data as any[], limites.length).map((item) =>
            item === "..." ? "..." : formatar(item, interno, width),
        );

        // Se todo item couber numa linha, preenche: uma coleção de mil
        // números não deve virar mil linhas.
        if (itens.every((item) => !item.includes("\n"))) {
            return `${abre}${preencher(itens, interno, width)}${fecha}`;
        }

        return `${abre}${itens.join(`\n${recuo}`)}${fecha}`;
    }

    if (data instanceof ClojureAtom) {
        const interno = indent + 7; // "#<Atom "
        return `#<Atom ${formatar(data.value, interno, width)}>`;
    }

    // Escalar que não cabe (uma string longa, por exemplo): não há como
    // quebrar sem alterar o valor.
    return plano;
}

/**
 * Formata um valor com quebras de linha.
 *
 * @param {any} data O valor a formatar.
 * @param {PrettyOptions} [opts] Largura e recuo inicial.
 * @return {string} O valor formatado, possivelmente em várias linhas.
 */
export function ppStr(data: any, opts: PrettyOptions = {}): string {
    const width = opts.width ?? LARGURA_PADRAO;
    const indent = opts.indent ?? 0;
    return formatar(data, indent, width);
}
