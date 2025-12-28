import type { SourceLocation } from "../types/index.js";

export class ClojureError extends Error {
    public loc?: SourceLocation | undefined;

    constructor(message: string, loc?: SourceLocation) {
        super(message);
        this.name = "ClojureError";
        this.loc = loc;
    }
}
