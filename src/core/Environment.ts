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
}
