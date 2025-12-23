import { Env } from "../core/Environment.js";

export class ClojureVector extends Array<any> {}

export type Atom = string | number;
export type Expression = Atom | List;
export interface List extends Array<Expression> {}

export interface UserFunction {
    params: string[];
    body: Expression;
    env: Env;
}
