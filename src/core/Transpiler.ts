import type { Expression } from "../types/index.js";
import {
    ClojureVector,
    ClojureKeyword,
    ClojureSymbol,
} from "../types/index.js";

/**
 * Converte um nome do Mini-Clojure em um identificador JavaScript válido.
 *
 * Só deve ser aplicado a **identificadores** (símbolos, parâmetros): aplicar
 * isso a um literal de string corrompe o literal — foi exatamente essa confusão
 * que gerou a issue #38.
 *
 * @param {string} name O nome a converter.
 * @return {string} Um identificador JavaScript válido.
 */
function mangle(name: string): string {
    return name.replace(/-/g, "_").replace(/\?/g, "$q").replace(/!/g, "$b");
}

export function transpile(ast: Expression): string {
    if (typeof ast === "number") {
        return ast.toString();
    }

    if (ast instanceof ClojureSymbol) {
        const val = ast.value;
        if (val.startsWith("js/")) {
            return val.slice(3);
        }
        return mangle(val);
    }

    // Uma `string` crua no AST é SEMPRE um literal de string: o Parser produz
    // ClojureSymbol para identificadores e faz JSON.parse nos literais (que já
    // chegam aqui sem as aspas). Aplicar mangling aqui corrompia o literal (#38).
    if (typeof ast === "string") {
        return JSON.stringify(ast);
    }

    if (ast instanceof ClojureKeyword) {
        return `"${ast.value}"`;
    }

    if (ast instanceof ClojureVector) {
        const items = ast.map(transpile).join(", ");
        return `[${items}]`;
    }

    if (Array.isArray(ast)) {
        if (ast.length === 0) return "null";

        const [op, ...args] = ast;

        let opStr = "";
        if (op instanceof ClojureSymbol) opStr = op.value;
        else if (typeof op === "string") opStr = op;

        if (opStr === "def") {
            const name = transpile(args[0]!);
            const val = transpile(args[1]!);
            return `globalThis.${name} = ${val};`;
        }

        if (opStr === "if") {
            const [cond, thenExpr, elseExpr] = args;
            // `elseExpr` ausente vira `null` literal — não a string "null".
            const elseStr =
                elseExpr === undefined || elseExpr === null
                    ? "null"
                    : transpile(elseExpr);
            return `(${transpile(cond!)} ? ${transpile(thenExpr!)} : ${elseStr})`;
        }

        if (opStr === "fn") {
            const params = args[0] as any[];
            const body = args[1];

            const jsParams = params
                .map((p) => {
                    const s =
                        p instanceof ClojureSymbol ? p.value : p.toString();
                    // Precisa casar com a mangling dos símbolos do corpo,
                    // senão (fn [ok?] ok?) gera parâmetro `ok?` e usa `ok$q`.
                    return mangle(s);
                })
                .join(", ");

            return `((${jsParams}) => ${transpile(body!)})`;
        }

        if (opStr === "do") {
            const exprs = args.map(transpile);
            const last = exprs.pop();
            const statements = exprs.map((s) => s + ";").join(" ");
            return `(() => { ${statements} return ${last}; })()`;
        }

        if (
            [
                "+",
                "-",
                "*",
                "/",
                ">",
                "<",
                ">=",
                "<=",
                "%",
                "&&",
                "||",
            ].includes(opStr)
        ) {
            const compiledArgs = args.map(transpile).join(` ${opStr} `);
            return `(${compiledArgs})`;
        }

        if (opStr === "=") {
            return `MCLJ_equals(${transpile(args[0]!)}, ${transpile(args[1]!)})`;
        }

        if (opStr === "print" || opStr === "println") {
            return `console.log(${args.map(transpile).join(", ")})`;
        }

        if (opStr === ".") {
            const [method, target, ...methodArgs] = args;
            let methodName = "";
            if (method instanceof ClojureSymbol) methodName = method.value;
            else if (typeof method === "string") methodName = method;
            else if (method instanceof ClojureKeyword)
                methodName = method.value;

            if (methodName.startsWith(":")) methodName = methodName.slice(1);
            else if (methodName.startsWith('"'))
                methodName = methodName.slice(1, -1);

            return `${transpile(target!)}.${methodName}(${methodArgs.map(transpile).join(", ")})`;
        }

        if (opStr.startsWith("js/")) {
            return opStr.slice(3);
        }

        const funcName = transpile(op!);
        const funcArgs = args.map(transpile).join(", ");
        return `${funcName}(${funcArgs})`;
    }

    return "null";
}
