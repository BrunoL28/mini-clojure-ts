import { Env } from "../core/Environment.js";

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
    loc?: SourceLocation;
}

export class ClojureMap extends Map<any, any> implements ILocatable {
    public loc?: SourceLocation;

    toString(): string {
        const entries = [];
        for (const [k, v] of this) {
            entries.push(`${String(k)} ${String(v)}`);
        }
        return `{${entries.join(" ")}}`;
    }
}

export class ClojureKeyword implements ILocatable {
    public loc?: SourceLocation;
    constructor(public value: string) {}

    toString() {
        return this.value;
    }
}

export class ClojureSymbol implements ILocatable {
    public loc?: SourceLocation;
    constructor(public value: string) {}

    toString() {
        return this.value;
    }
}

export class ClojureVector extends Array<any> implements ILocatable {
    public loc?: SourceLocation;

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
    loc?: SourceLocation;
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
