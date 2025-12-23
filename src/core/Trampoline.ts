export class Bounce {
    constructor(public thunk: () => any) {}
}

export function trampoline(result: any): any {
    while (result instanceof Bounce) {
        result = result.thunk();
    }
    return result;
}
