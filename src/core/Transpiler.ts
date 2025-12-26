import type { Expression } from "../types/index.js";
import { ClojureVector, ClojureKeyword } from "../types/index.js";

export function transpile(ast: Expression): string {
    if (typeof ast === "number") {
        return ast.toString();
    }

    if (typeof ast === "string") {
        if (ast.startsWith('"')) return ast;
        if (ast.startsWith("js/")) {
            return ast.slice(3);
        }
        return ast.replace(/-/g, "_").replace(/\?/g, "$q").replace(/!/g, "$b");
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
        const opStr = typeof op === "string" ? op : "";

        if (opStr === "def") {
            const name = transpile(args[0]!);
            const val = transpile(args[1]!);
            return `globalThis.${name} = ${val};`;
        }

        if (opStr === "if") {
            const [cond, thenExpr, elseExpr] = args;
            return `(${transpile(cond!)} ? ${transpile(thenExpr!)} : ${transpile(elseExpr || "null")})`;
        }

        if (opStr === "fn") {
            const params = args[0] as any[];
            const body = args[1];

            const jsParams = params
                .map((p) => p.toString().replace(/-/g, "_"))
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
            return `(${transpile(args[0]!)} === ${transpile(args[1]!)})`;
        }

        if (opStr === "print" || opStr === "println") {
            return `console.log(${args.map(transpile).join(", ")})`;
        }

        if (opStr === ".") {
            const [method, target, ...methodArgs] = args;
            let methodName = method!.toString();
            if (methodName.startsWith(":")) methodName = methodName.slice(1);
            else if (methodName.startsWith('"'))
                methodName = methodName.slice(1, -1);

            return `${transpile(target!)}.${methodName}(${methodArgs.map(transpile).join(", ")})`;
        }

        if (opStr.startsWith("js/")) {
            return opStr.slice(3);
        }

        const funcName = transpile(op!).replace(/-/g, "_");
        const funcArgs = args.map(transpile).join(", ");
        return `${funcName}(${funcArgs})`;
    }

    return "null";
}
