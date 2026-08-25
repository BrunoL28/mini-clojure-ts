import { ClojureReferenceError } from "../errors/ReferenceError.js";

export class Env {
    private vars: { [key: string]: any } = {};

    constructor(
        public outer: Env | null = null,
        binds: string[] = [],
        exprs: any[] = [],
    ) {
        for (let i = 0; i < binds.length && i < exprs.length; i++) {
            this.set(binds[i]!, exprs[i]);
        }
    }

    set(name: string, value: any) {
        this.vars[name] = value;
    }

    get(name: string): any {
        if (name in this.vars) {
            return this.vars[name];
        }
        if (this.outer) {
            return this.outer.get(name);
        }
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
