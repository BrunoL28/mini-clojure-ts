import { ClojureReferenceError } from "../errors/ReferenceError.js";

export class Env {
    // `Object.create(null)`, não `{}` nem `Map`.
    //
    // `{}` era um bug: `"constructor" in vars` é verdadeiro por causa do
    // protótipo, então símbolos indefinidos como `constructor` ou `toString`
    // resolviam para membros de `Object.prototype` em vez de dar erro.
    //
    // `Map` corrige isso mas custa caro: medido, ficou ~25% mais lento que
    // objeto em todos os benchmarks. V8 otimiza acesso a propriedade de
    // objeto com inline caches, e escopos são pequenos e de formato estável.
    // Um objeto sem protótipo tem a correção do `Map` com a velocidade do `{}`.
    private vars: Record<string, any> = Object.create(null);

    constructor(
        public outer: Env | null = null,
        binds: string[] = [],
        exprs: any[] = [],
    ) {
        for (let i = 0; i < binds.length && i < exprs.length; i++) {
            this.vars[binds[i]!] = exprs[i];
        }
    }

    set(name: string, value: any) {
        this.vars[name] = value;
    }

    get(name: string): any {
        // Laço em vez de recursão: o lookup é o caminho mais quente do
        // interpretador, e isso evita um frame de pilha por escopo.
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let scope: Env | null = this;
        do {
            const value = scope.vars[name];
            // O `in` só roda quando o valor é `undefined`, para distinguir
            // "ligado a nil" de "não ligado".
            if (value !== undefined || name in scope.vars) return value;
            scope = scope.outer;
        } while (scope !== null);

        throw new ClojureReferenceError(name);
    }

    /**
     * Indica se o nome está ligado NESTE escopo, ignorando os escopos externos.
     *
     * @param {string} name O nome procurado.
     * @return {boolean} `true` se o nome pertence a este escopo.
     */
    hasOwn(name: string): boolean {
        return name in this.vars;
    }

    /**
     * Lê um nome ligado NESTE escopo, sem consultar os escopos externos.
     * É o que impede `modulo/reduce` de resolver para a stdlib herdada.
     *
     * @param {string} name O nome procurado.
     * @return {any} O valor, ou `undefined` se não pertencer a este escopo.
     */
    getOwn(name: string): any {
        return this.vars[name];
    }

    /**
     * Nomes ligados NESTE escopo — a superfície pública de um módulo.
     *
     * @return {string[]} Os nomes definidos diretamente neste escopo.
     */
    ownKeys(): string[] {
        return Object.keys(this.vars);
    }

    /**
     * O escopo raiz da cadeia (onde vive a stdlib).
     *
     * @return {Env} O ambiente mais externo.
     */
    root(): Env {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let current: Env = this;
        while (current.outer) current = current.outer;
        return current;
    }
}
