export class ClojureError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ClojureError";
    }
}
