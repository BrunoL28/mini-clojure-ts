import { ClojureError } from "./ClojureError.js";

export class ClojureReferenceError extends ClojureError {
    constructor(symbol: string) {
        super(`Símbolo '${symbol}' não encontrado.`);
        this.name = "ClojureReferenceError";
    }
}
