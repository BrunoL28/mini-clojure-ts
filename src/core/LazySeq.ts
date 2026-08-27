import { checkTimeLimit } from "./Limits.js";

/**
 * Sentinela de fim de sequência.
 *
 * Um `Symbol` privado nunca colide com um valor do usuário — `null`, `false` e
 * `undefined` são valores legítimos numa sequência.
 */
const FIM: unique symbol = Symbol("fim-de-sequencia");

/** Produz o próximo elemento, ou `FIM`. */
export type Proximo = () => any;

export { FIM };

/**
 * Sequência preguiçosa: os elementos são produzidos sob demanda e guardados.
 *
 * O subset é conservador de propósito. Só os construtores e transformações de
 * sequência produzem `LazySeq`; tudo que precisa da coleção inteira — `count`,
 * `=`, hash, destructuring — **realiza** antes de trabalhar. Isso mantém a
 * semântica existente intacta e concentra a preguiça onde ela paga: pipelines
 * com terminação antecipada, e sequências infinitas.
 *
 * O protocolo é uma closure `Proximo`, não um gerador do JavaScript. Medido:
 * geradores encadeados custam ~8x o custo de um laço eager, enquanto closures
 * custam ~2,5x. A diferença aparece em qualquer pipeline de tamanho real.
 *
 * Os elementos já produzidos ficam em cache: percorrer duas vezes não recalcula.
 */
export class LazySeq {
    private realizados: any[] = [];
    private proximo: Proximo | null = null;
    private esgotada = false;
    private passos = 0;

    /**
     * @param {() => Proximo} criar Fábrica do produtor. É chamada uma vez, na
     *     primeira realização.
     */
    constructor(private criar: () => Proximo) {}

    /** Produz elementos até ter `quantidade` em cache, ou a fonte acabar. */
    private garantir(quantidade: number): void {
        if (this.esgotada) return;
        if (this.proximo === null) this.proximo = this.criar();

        while (this.realizados.length < quantidade) {
            // Em lote: consultar o limite a cada elemento custaria caro, e
            // sem consultar nunca, realizar uma sequência infinita ignoraria
            // `--timeout` — o avaliador não roda enquanto o laço está aqui.
            if (++this.passos >= 1024) {
                this.passos = 0;
                checkTimeLimit();
            }

            const valor = this.proximo();
            if (valor === FIM) {
                this.esgotada = true;
                this.proximo = null;
                return;
            }
            this.realizados.push(valor);
        }
    }

    /**
     * Os primeiros `quantidade` elementos. Seguro em sequência infinita.
     *
     * @param {number} quantidade Quantos elementos produzir.
     * @return {any[]} Os elementos disponíveis, no máximo `quantidade`.
     */
    primeiros(quantidade: number): any[] {
        this.garantir(quantidade);
        return this.realizados.slice(0, quantidade);
    }

    /**
     * A sequência inteira, como array.
     *
     * **Não termina em sequência infinita** — é a natureza da operação. Com
     * `--timeout` ligado, a execução é interrompida com erro explicativo.
     *
     * @return {any[]} Todos os elementos.
     */
    realizar(): any[] {
        this.garantir(Number.POSITIVE_INFINITY);
        return this.realizados;
    }

    /**
     * Indica se a sequência é vazia, produzindo no máximo um elemento.
     *
     * @return {boolean} `true` se não há nenhum elemento.
     */
    vazia(): boolean {
        this.garantir(1);
        return this.realizados.length === 0;
    }

    /**
     * Garante `quantidade` elementos e devolve o cache **sem copiar**.
     *
     * É a base do consumo em blocos: quem reduz percorre o array direto, em
     * laço apertado, em vez de chamar uma closure por elemento.
     *
     * @param {number} quantidade Quantos elementos garantir.
     * @return {any[]} O cache interno. Não modifique.
     */
    garantirAte(quantidade: number): any[] {
        this.garantir(quantidade);
        return this.realizados;
    }

    /**
     * Um cursor independente sobre esta sequência.
     *
     * Lê primeiro do cache e só então produz mais, para dois consumidores não
     * recalcularem os mesmos elementos.
     *
     * @return {Proximo} O produtor.
     */
    cursor(): Proximo {
        let i = 0;
        return () => {
            const cache = this.realizados;
            if (i < cache.length) return cache[i++];
            if (this.esgotada) return FIM;

            // Produção de um elemento, sem passar por `garantir`: numa cadeia
            // de transformações isto roda por elemento e por elo, então o
            // laço e a chamada extras apareciam no benchmark.
            if (this.proximo === null) this.proximo = this.criar();
            if (++this.passos >= 1024) {
                this.passos = 0;
                checkTimeLimit();
            }

            const valor = this.proximo();
            if (valor === FIM) {
                this.esgotada = true;
                this.proximo = null;
                return FIM;
            }

            cache.push(valor);
            i++;
            return valor;
        };
    }

    *[Symbol.iterator](): Iterator<any> {
        const proximo = this.cursor();
        for (;;) {
            const valor = proximo();
            if (valor === FIM) return;
            yield valor;
        }
    }

    toString(): string {
        return "#<LazySeq>";
    }
}

/**
 * Cria uma sequência preguiçosa a partir de uma fábrica de produtor.
 *
 * @param {() => Proximo} criar A fábrica.
 * @return {LazySeq} A sequência.
 */
export function lazy(criar: () => Proximo): LazySeq {
    return new LazySeq(criar);
}

/**
 * Produtor sobre um valor sequencial, **sem realizá-lo**.
 *
 * É o que permite `(take 3 (range))`: se `map` e `filter` realizassem a
 * entrada, transformar uma sequência infinita travaria.
 *
 * @param {any} valor O valor.
 * @return {Proximo | null} O produtor, ou `null` se o valor não for sequencial.
 */
export function pullDe(valor: any): Proximo | null {
    if (valor === null || valor === undefined) return () => FIM;
    if (valor instanceof LazySeq) return valor.cursor();

    if (Array.isArray(valor)) {
        let i = 0;
        return () => (i < valor.length ? valor[i++] : FIM);
    }

    if (typeof valor === "string") {
        let i = 0;
        return () => (i < valor.length ? valor[i++] : FIM);
    }

    return null;
}

/**
 * Converte qualquer coisa sequencial num array, realizando se for preguiçosa.
 *
 * @param {any} valor O valor.
 * @return {any[] | null} O array, ou `null` se o valor não for sequencial.
 */
export function realizarSeq(valor: any): any[] | null {
    if (valor instanceof LazySeq) return valor.realizar();
    if (Array.isArray(valor)) return valor;
    return null;
}

/**
 * Indica se o valor é uma sequência — array ou preguiçosa.
 *
 * @param {any} valor O valor.
 * @return {boolean} `true` se for sequencial.
 */
export function ehSequencial(valor: any): boolean {
    return Array.isArray(valor) || valor instanceof LazySeq;
}
