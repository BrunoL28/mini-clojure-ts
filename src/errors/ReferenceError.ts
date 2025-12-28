import { ClojureError } from "./ClojureError.js";
import type { SourceLocation } from "../types/index.js";

export class ClojureReferenceError extends ClojureError {
    constructor(symbol: string, loc?: SourceLocation) {
        super(`Símbolo '${symbol}' não encontrado.`, loc);
        this.name = "ClojureReferenceError";
    }
}
