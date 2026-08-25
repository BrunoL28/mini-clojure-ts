import { Env } from "../core/Environment.js";
import { HAMT } from "../dataStructures/HAMT.js";

export interface SourceLocation {
    file?: string;
    start: {
        line: number;
        col: number;
        index: number;
    };
    end: {
        line: number;
        col: number;
        index: number;
    };
}

export interface Token {
    type: string;
    value: string;
    loc: SourceLocation;
}

export interface ILocatable {
    loc?: SourceLocation | undefined;
}

export class ClojureMap implements ILocatable {
    public loc?: SourceLocation | undefined;
    private hamt: HAMT;

    constructor(initialHamt?: HAMT) {
        this.hamt = initialHamt || new HAMT();
    }

    get(key: any): any {
        return this.hamt.get(key);
    }

    has(key: any): boolean {
        return this.hamt.has(key);
    }

    get size(): number {
        return this.hamt.size;
    }

    assoc(key: any, val: any): ClojureMap {
        const newHamt = this.hamt.set(key, val);
        const map = new ClojureMap(newHamt);
        map.loc = this.loc;
        return map;
    }

    dissoc(key: any): ClojureMap {
        const newHamt = this.hamt.delete(key);
        const map = new ClojureMap(newHamt);
        map.loc = this.loc;
        return map;
    }

    [Symbol.iterator]() {
        return this.hamt[Symbol.iterator]();
    }

    entries() {
        return this.hamt.entries();
    }

    keys() {
        return this.hamt.entries().map((e) => e[0]);
    }

    values() {
        return this.hamt.entries().map((e) => e[1]);
    }

    toString(): string {
        const entriesStr: string[] = [];
        for (const [k, v] of this) {
            entriesStr.push(`${String(k)} ${String(v)}`);
        }
        return `{${entriesStr.join(" ")}}`;
    }
}

export class ClojureKeyword implements ILocatable {
    public loc?: SourceLocation | undefined;
    constructor(public value: string) {}

    toString() {
        return this.value;
    }
}

export class ClojureSymbol implements ILocatable {
    public loc?: SourceLocation | undefined;
    constructor(public value: string) {}

    toString() {
        return this.value;
    }
}

export class ClojureVector extends Array<any> implements ILocatable {
    public loc?: SourceLocation | undefined;

    /**
     * Cria um vetor a partir dos itens informados.
     *
     * SEMPRE use isto em vez de `new ClojureVector(...items)`: como
     * `ClojureVector` estende `Array`, `new ClojureVector(3)` cai no construtor
     * `Array(length)` e produz um vetor esparso de 3 buracos em vez de `[3]`.
     *
     * @param {any[]} items Os itens do vetor.
     * @return {ClojureVector} O vetor construído.
     */
    static override of(...items: any[]): ClojureVector {
        return ClojureVector.fromArray(items);
    }

    /**
     * Cria um vetor a partir de um array já existente.
     *
     * Prefira isto a `of(...array)` em qualquer caminho onde o array possa ser
     * grande: espalhar um array de centenas de milhares de itens como
     * argumentos estoura o limite de argumentos do JavaScript.
     *
     * @param {any[]} items Os itens do vetor.
     * @return {ClojureVector} O vetor construído.
     */
    static fromArray(items: any[]): ClojureVector {
        const vector = new ClojureVector();
        for (let i = 0; i < items.length; i++) vector.push(items[i]);
        return vector;
    }

    toString(): string {
        return `[${this.map(String).join(" ")}]`;
    }
}

/**
 * Um módulo carregado via `require`, acessível por alias (`math/soma`).
 *
 * Guarda o `Env` do módulo em vez de uma cópia dos valores, então `def`
 * posteriores dentro do módulo continuam visíveis pelo alias.
 */
export class ClojureNamespace {
    constructor(
        public name: string,
        public path: string,
        public env: Env,
    ) {}

    toString() {
        return `#<ns ${this.name}>`;
    }
}

export class ClojureAtom {
    constructor(public value: any) {}

    toString() {
        return `(atom ${String(this.value)})`;
    }
}

export class ClojureMacro {
    constructor(
        public params: string[],
        public body: Expression,
        public env: Env,
    ) {}

    toString() {
        return "#<macro>";
    }
}

export interface ClojureList extends Array<Expression> {
    loc?: SourceLocation | undefined;
}

export type Atom =
    | string
    | number
    | ClojureKeyword
    | ClojureSymbol
    | null
    | boolean;

export type Expression =
    | Atom
    | ClojureList
    | ClojureVector
    | ClojureMap
    | ClojureAtom;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface List extends Array<Expression> {}

export interface UserFunction {
    params: any[];
    body: Expression;
    env: Env;
}
