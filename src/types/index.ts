import { Env } from "../core/Environment.js";

export class ClojureMap extends Map<any, any> {}

export class ClojureKeyword {
    constructor(public value: string) {}

    toString() {
        return this.value;
    }
}

export class ClojureVector extends Array<any> {}

export type Atom = string | number | ClojureKeyword;
export type Expression = Atom | List | ClojureVector | ClojureMap;
export interface List extends Array<Expression> {}

export interface UserFunction {
    params: string[];
    body: Expression;
    env: Env;
}
