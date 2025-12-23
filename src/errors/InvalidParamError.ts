import { ClojureError } from "./ClojureError.js";

export class InvalidParamError extends ClojureError {
    constructor(message: string) {
        super(message);
        this.name = "InvalidParamError";
    }
}
