import { Reduced } from "../types/index.js";
import { callFn, truthy } from "./Invoke.js";
import { FIM, LazySeq } from "./LazySeq.js";
import type { Proximo } from "./LazySeq.js";

/**
 * Transdutores: transformações de sequência independentes da coleção.
 *
 * Um transdutor é uma função `(rf) -> rf`, onde `rf` é uma função de redução
 * `(acumulador, item) -> acumulador`. Como não sabem de onde os itens vêm nem
 * para onde vão, os mesmos `map` e `filter` servem para reduzir, construir
 * uma coleção ou alimentar uma sequência preguiçosa — sem alocar as coleções
 * intermediárias de um pipeline encadeado.
 *
 * Os transdutores com estado (`take`, `drop`, `drop-while`) guardam o estado
 * na closure criada a cada aplicação a um `rf`, então reusar o mesmo
 * transdutor em duas reduções não vaza estado de uma para a outra.
 */

/** Função de redução: `(acumulador, item) -> acumulador`. */
export type RF = (acumulador: any, item: any) => any;

/** Transdutor: transforma uma função de redução em outra. */
export type Transdutor = (rf: RF) => RF;

/** Garante que o valor está marcado como final. */
export function garantirReduzido(valor: any): Reduced {
    return valor instanceof Reduced ? valor : new Reduced(valor);
}

/** Desembrulha um valor final, se for um. */
export function desreduzir(valor: any): any {
    return valor instanceof Reduced ? valor.value : valor;
}

/**
 * Reduz uma sequência respeitando a terminação antecipada.
 *
 * @param {RF} rf A função de redução.
 * @param {any} inicial O acumulador inicial.
 * @param {Iterable<any>} itens Os itens.
 * @return {any} O acumulador final, já desembrulhado.
 */
export function reduzir(rf: RF, inicial: any, itens: Iterable<any>): any {
    let acumulador = inicial;
    for (const item of itens) {
        acumulador = rf(acumulador, item);
        if (acumulador instanceof Reduced) return acumulador.value;
    }
    return acumulador;
}

/**
 * Reduz consumindo um produtor, **sem materializar a fonte**.
 *
 * É o que faz um transdutor com `take` terminar sobre sequência infinita:
 * realizar a entrada antes de reduzir anularia a terminação antecipada.
 *
 * @param {RF} rf A função de redução.
 * @param {any} inicial O acumulador inicial.
 * @param {Proximo} proximo O produtor da fonte.
 * @return {any} O acumulador final, já desembrulhado.
 */
export function reduzirPull(rf: RF, inicial: any, proximo: Proximo): any {
    let acumulador = inicial;
    for (;;) {
        const item = proximo();
        if (item === FIM) return acumulador;
        acumulador = rf(acumulador, item);
        if (acumulador instanceof Reduced) return acumulador.value;
    }
}

/**
 * Tamanho do bloco no consumo de sequência preguiçosa.
 *
 * Mesmo valor que o Clojure usa em seqs chunked, e pela mesma razão: reduzir
 * elemento a elemento através de uma closure custa caro, e reduzir um array
 * em laço apertado é bem mais rápido. O preço é o mesmo do Clojure — uma
 * redução que termina cedo pode ter produzido até 31 elementos a mais.
 */
const BLOCO = 32;

/**
 * Reduz uma sequência preguiçosa em blocos, respeitando `reduced`.
 *
 * @param {RF} rf A função de redução.
 * @param {any} inicial O acumulador inicial.
 * @param {LazySeq} fonte A sequência.
 * @return {any} O acumulador final, já desembrulhado.
 */
export function reduzirLazy(rf: RF, inicial: any, fonte: LazySeq): any {
    let acumulador = inicial;
    let i = 0;

    for (;;) {
        const cache = fonte.garantirAte(i + BLOCO);
        if (i >= cache.length) return acumulador;

        const limite = cache.length;
        for (; i < limite; i++) {
            acumulador = rf(acumulador, cache[i]);
            if (acumulador instanceof Reduced) return acumulador.value;
        }
    }
}

/**
 * Reduz qualquer valor sequencial, escolhendo o caminho mais rápido possível.
 *
 * @param {RF} rf A função de redução.
 * @param {any} inicial O acumulador inicial.
 * @param {any} fonte Array, string ou sequência preguiçosa.
 * @return {any} O acumulador final, já desembrulhado.
 */
export function reduzirFonte(rf: RF, inicial: any, fonte: any): any {
    if (fonte instanceof LazySeq) return reduzirLazy(rf, inicial, fonte);
    if (Array.isArray(fonte)) return reduzir(rf, inicial, fonte);
    return reduzir(rf, inicial, fonte as Iterable<any>);
}

export function mapeando(f: any): Transdutor {
    return (rf) => (acumulador, item) => rf(acumulador, callFn(f, item));
}

export function filtrando(pred: any): Transdutor {
    return (rf) => (acumulador, item) =>
        truthy(callFn(pred, item)) ? rf(acumulador, item) : acumulador;
}

export function removendo(pred: any): Transdutor {
    return (rf) => (acumulador, item) =>
        truthy(callFn(pred, item)) ? acumulador : rf(acumulador, item);
}

export function pegando(n: number): Transdutor {
    return (rf) => {
        let restam = n;
        return (acumulador, item) => {
            if (restam <= 0) return garantirReduzido(acumulador);
            restam--;
            const resultado = rf(acumulador, item);
            // Marca como final já no último item aceito, para a fonte não
            // produzir mais um elemento à toa.
            return restam <= 0 ? garantirReduzido(resultado) : resultado;
        };
    };
}

export function descartando(n: number): Transdutor {
    return (rf) => {
        let restam = n;
        return (acumulador, item) => {
            if (restam > 0) {
                restam--;
                return acumulador;
            }
            return rf(acumulador, item);
        };
    };
}

export function pegandoEnquanto(pred: any): Transdutor {
    return (rf) => (acumulador, item) =>
        truthy(callFn(pred, item))
            ? rf(acumulador, item)
            : garantirReduzido(acumulador);
}

export function descartandoEnquanto(pred: any): Transdutor {
    return (rf) => {
        let descartando = true;
        return (acumulador, item) => {
            if (descartando && truthy(callFn(pred, item))) return acumulador;
            descartando = false;
            return rf(acumulador, item);
        };
    };
}
