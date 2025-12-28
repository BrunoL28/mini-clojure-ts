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
}

export class ClojureAtom {
    constructor(public value: any) {}
}

export class ClojureMacro {
    constructor(
        public params: string[],
        public body: Expression,
        public env: Env,
    ) {}
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

export interface List extends Array<Expression> {}

export interface UserFunction {
    params: any[];
    body: Expression;
    env: Env;
}
