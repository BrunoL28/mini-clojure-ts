export function tokenize(input: string): string[] {
    const codeWithoutComments = input.replace(/;.*$/gm, "");
    const regex = /"(?:\\.|[^\\"])*"?|[\(\)\[\]\{\}'`~]|[^\s,()\[\]\{\}'`~]+/g;
    const tokens = codeWithoutComments.match(regex);
    return tokens || [];
}
