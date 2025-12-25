export function tokenize(input: string): string[] {
    const codeClean = input.replace(/;.*$/gm, "").replace(/,/g, " ");
    const regex =
        /"(?:\\.|[^\\"])*"?|[\(\)\[\]\{\}'`~@]|[^\s,()\[\]\{\}'`~@]+/g;
    const tokens = codeClean.match(regex);
    return tokens || [];
}
