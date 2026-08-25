/**
 * Runtime do código compilado.
 *
 * O JS gerado pelo compilador importa este módulo. A decisão de design central
 * é **reusar a stdlib do interpretador** (`initialConfig`) em vez de manter uma
 * segunda implementação em JS: é isso que garante que um programa produza o
 * mesmo resultado interpretado e compilado (#19), sem duas listas de funções
 * para manter em sincronia.
 *
 * Funções compiladas são funções JS de verdade, e `callFn` já trata esse caso,
 * então a stdlib funciona sem adaptação.
 */
import {
    ClojureVector,
    ClojureKeyword,
    ClojureSymbol,
    ClojureMap,
} from "../types/index.js";
import { initialConfig } from "../stdlib/index.js";
import { callFn, truthy as isTruthy } from "../core/Invoke.js";
import { equals as structuralEquals } from "../core/Runtime.js";
import { prStr as printStr } from "../core/Printer.js";

/** A stdlib, indexada pelo nome original (`every?`, `assoc-in`, ...). */
export const core: { [key: string]: any } = initialConfig;

export const truthy = isTruthy;
export const equals = structuralEquals;
export const prStr = printStr;

const keywordCache = new Map<string, ClojureKeyword>();

/**
 * Keyword internada. O cache mantém `(identical? :a :a)` verdadeiro no
 * compilado, como acontece no interpretador quando a keyword vem do mesmo nó.
 *
 * @param {string} name A keyword com os dois-pontos (`":a"`).
 * @return {ClojureKeyword} A keyword internada.
 */
export function kw(name: string): ClojureKeyword {
    let cached = keywordCache.get(name);
    if (!cached) {
        cached = new ClojureKeyword(name);
        keywordCache.set(name, cached);
    }
    return cached;
}

/**
 * Símbolo — usado pelas formas `quote`/`quasiquote`.
 *
 * @param {string} name O nome do símbolo.
 * @return {ClojureSymbol} O símbolo.
 */
export function sym(name: string): ClojureSymbol {
    return new ClojureSymbol(name);
}

/**
 * Vetor `[...]`.
 *
 * @param {any[]} items Os itens.
 * @return {ClojureVector} O vetor.
 */
export function vec(items: any[]): ClojureVector {
    return ClojureVector.of(...items);
}

/**
 * Lista `(...)` — representada como Array simples, igual ao interpretador.
 *
 * @param {any[]} items Os itens.
 * @return {any[]} A lista.
 */
export function list(items: any[]): any[] {
    return items;
}

/**
 * Mapa `{...}` a partir de pares achatados `[k1, v1, k2, v2]`.
 *
 * @param {any[]} pairs Chaves e valores alternados.
 * @return {ClojureMap} O mapa persistente.
 */
export function map(pairs: any[]): ClojureMap {
    let result = new ClojureMap();
    for (let i = 0; i < pairs.length; i += 2) {
        result = result.assoc(pairs[i], pairs[i + 1]);
    }
    return result;
}

/**
 * Chamada genérica: cobre função JS, keyword-como-função e qualquer outro
 * valor invocável do subset.
 *
 * @param {any} f O alvo da chamada.
 * @param {any[]} args Os argumentos.
 * @return {any} O resultado.
 */
export function call(f: any, ...args: any[]): any {
    return callFn(f, ...args);
}

/**
 * Acesso posicional para destructuring de sequência.
 * Fora dos limites devolve `nil`, como o interpretador (nil punning).
 *
 * @param {any} coll A coleção.
 * @param {number} index O índice.
 * @return {any} O elemento ou `null`.
 */
export function nth_(coll: any, index: number): any {
    if (coll === null || coll === undefined) return null;
    if (typeof coll === "string")
        return index < coll.length ? coll[index] : null;
    if (!Array.isArray(coll)) return null;
    return index < coll.length ? coll[index] : null;
}

/**
 * Resto de uma sequência a partir de um índice — o `&` do destructuring.
 *
 * @param {any} coll A coleção.
 * @param {number} index O índice inicial.
 * @return {ClojureVector} Os elementos restantes.
 */
export function restFrom(coll: any, index: number): ClojureVector {
    if (!Array.isArray(coll)) return ClojureVector.of();
    return ClojureVector.of(...coll.slice(index));
}

/**
 * Busca por keyword num mapa, com valor padrão — o `:keys`/`:or` do
 * destructuring de mapas.
 *
 * @param {any} m O mapa.
 * @param {string} keyName A keyword com os dois-pontos.
 * @param {any} fallback O valor quando a chave está ausente.
 * @return {any} O valor encontrado ou o padrão.
 */
export function getKw(m: any, keyName: string, fallback: any = null): any {
    if (!(m instanceof ClojureMap)) return fallback;
    const value = m.get(kw(keyName));
    return value === undefined ? fallback : value;
}

/**
 * Busca por chave arbitrária num mapa, com valor padrão.
 *
 * @param {any} m O mapa.
 * @param {any} key A chave.
 * @param {any} fallback O valor quando a chave está ausente.
 * @return {any} O valor encontrado ou o padrão.
 */
export function getKey(m: any, key: any, fallback: any = null): any {
    if (!(m instanceof ClojureMap)) return fallback;
    const value = m.get(key);
    return value === undefined ? fallback : value;
}

/**
 * Mensagem de erro ligada ao símbolo do `catch`.
 *
 * O interpretador liga a **mensagem** (string), não o objeto de erro; o
 * compilado faz o mesmo para manter paridade.
 *
 * @param {any} e O valor capturado.
 * @return {string} A mensagem.
 */
export function errMsg(e: any): string {
    return e instanceof Error ? e.message : String(e);
}
