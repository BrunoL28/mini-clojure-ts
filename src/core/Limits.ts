import { ClojureError } from "../errors/ClojureError.js";

/**
 * Limites de execução e de impressão.
 *
 * O objetivo é diagnóstico, não mágica: um programa que estoura o limite
 * recebe um erro dizendo exatamente o que aconteceu, em vez de travar o
 * processo em silêncio.
 */

// ---------- Limite de tempo ----------

let deadline: number | null = null;
let limiteMs = 0;
let passos = 0;

/**
 * Consultar o relógio a cada forma avaliada custaria caro. Verificamos a cada
 * N passos: o erro na detecção é de milissegundos, irrelevante para um limite
 * medido em segundos.
 */
const INTERVALO_DE_CHECAGEM = 2048;

/**
 * Inicia um limite de tempo para a execução atual.
 *
 * @param {number} ms Tempo máximo em milissegundos.
 */
export function startTimeLimit(ms: number): void {
    limiteMs = ms;
    deadline = performance.now() + ms;
    passos = 0;
}

/** Remove o limite de tempo. */
export function clearTimeLimit(): void {
    deadline = null;
    passos = 0;
}

/** Indica se há um limite de tempo ativo. */
export function hasTimeLimit(): boolean {
    return deadline !== null;
}

/**
 * Verifica o limite de tempo. Chamado do caminho quente do avaliador, por isso
 * sai imediatamente quando não há limite ativo.
 *
 * @throws {ClojureError} Quando o tempo se esgota.
 */
export function checkTimeLimit(): void {
    if (deadline === null) return;
    if (++passos < INTERVALO_DE_CHECAGEM) return;

    passos = 0;
    if (performance.now() > deadline) {
        const excedido = deadline;
        clearTimeLimit();
        void excedido;
        throw new ClojureError(
            `Execução interrompida: passou do limite de ${limiteMs} ms. ` +
                `Isso costuma ser recursão sem caso base ou laço que não termina. ` +
                `Ajuste com --timeout, ou 0 para desligar.`,
        );
    }
}

// ---------- Limites de impressão ----------

export interface PrintLimits {
    /** Máximo de itens mostrados por coleção. `null` = sem limite. */
    length: number | null;
    /** Profundidade máxima de aninhamento. `null` = sem limite. */
    level: number | null;
}

// Padrão sem limite: `pr-str` precisa continuar fazendo roundtrip com
// `read-string`. Quem limita é o contexto de exibição (REPL, `--print-length`).
const limitesDeImpressao: PrintLimits = { length: null, level: null };

/**
 * Ajusta os limites de impressão.
 *
 * @param {Partial<PrintLimits>} limites Os limites a alterar.
 */
export function setPrintLimits(limites: Partial<PrintLimits>): void {
    if (limites.length !== undefined)
        limitesDeImpressao.length = limites.length;
    if (limites.level !== undefined) limitesDeImpressao.level = limites.level;
}

/**
 * Limites de impressão em vigor.
 *
 * @return {PrintLimits} Os limites atuais.
 */
export function getPrintLimits(): PrintLimits {
    return limitesDeImpressao;
}
