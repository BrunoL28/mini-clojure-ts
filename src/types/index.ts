import { Env } from "../core/Environment.js";

export class ClojureMap extends Map<any, any> {}

export class ClojureKeyword {
    constructor(public value: string) {}

    toString() {
        return this.value;
    }
}

export class ClojureVector extends Array<any> {}

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

export type Atom = string | number | ClojureKeyword;
export type Expression = Atom | List | ClojureVector | ClojureMap | ClojureAtom;
export interface List extends Array<Expression> {}

export interface UserFunction {
    params: any[];
    body: Expression;
    env: Env;
}
