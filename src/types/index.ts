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

    toString(): string {
        return `[${this.map(String).join(" ")}]`;
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
