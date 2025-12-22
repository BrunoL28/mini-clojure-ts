import * as fs from "fs";
import * as path from "path";

// --- TIPOS ---
// Aqui será definido o que nosso interpretador consegue entender

type Atom = string | number;
type Expression = Atom | List;
interface List extends Array<Expression> {}

// Estrutura de uma função criada pelo utilizador
interface UserFunction {
    params: string[];
    body: Expression;
    env: Env;
}

// --- CLASSE ENVIRONMENT (Ambiente) ---
class Env {
    private vars: { [key: string]: any } = {};

    constructor(
        public outer: Env | null = null,
        binds: string[] = [],
        exprs: any[] = [],
    ) {
        for (let i = 0; i < binds.length && i < exprs.length; i++) {
            this.set(binds[i]!, exprs[i]);
        }
    }

    // Define um valor neste escopo
    set(name: string, value: any) {
        this.vars[name] = value;
    }

    // Busca um valor (aqui ou nos pais)
    get(name: string): any {
        if (name in this.vars) {
            return this.vars[name];
        }
        if (this.outer) {
            return this.outer.get(name);
        }
        throw new Error(`Símbolo '${name}' não encontrado.`);
    }
}

const globalEnv = new Env();

function tokenize(input: string): string[] {
    // 1. /"(?:\\.|[^\\"])*"?/ -> Captura strings completas (ex: "olá mundo")
    // 2. /[\(\)]/             -> Captura parênteses individuais
    // 3. /[^\s()]+/           -> Captura símbolos e números (tudo o que não for espaço ou parenteses)
    const regex = /"(?:\\.|[^\\"])*"?|[\(\)]|[^\s()]+/g;

    const tokens = input.match(regex);
    return tokens || [];
}

// --- 2. Parser (Síntaxe) ---
// Transforma a lista de tokens numa Árvore de Sintaxe Abstrata (AST).
// Em Clojure, o código é uma lista de listas.
function parse(tokens: string[]): Expression {
    if (tokens.length === 0) {
        throw new Error("Fim inesperado da entrada");
    }

    const token = tokens.shift()!;

    if (token === "(") {
        const list: List = [];
        while (tokens[0] !== ")") {
            list.push(parse(tokens));
        }
        tokens.shift();
        return list;
    } else if (token === ")") {
        throw new Error("Parênteses ')' inesperado");
    } else {
        const number = parseFloat(token);
        return isNaN(number) ? token : number;
    }
}

// --- 3. ENVIRONMENT ---
const initialConfig: { [key: string]: any } = {
    "+": (...args: number[]) => args.reduce((a, b) => a + b, 0),
    "-": (a: number, b: number) => a - b,
    "*": (...args: number[]) => args.reduce((a, b) => a * b, 1),
    "/": (a: number, b: number) => a / b,
    ">": (a: number, b: number) => a > b,
    "<": (a: number, b: number) => a < b,
    ">=": (a: number, b: number) => a >= b,
    "<=": (a: number, b: number) => a <= b,
    "=": (a: any, b: any) => a === b,
    print: (...args: any[]) => {
        console.log(...args);
        return null;
    },
    true: true,
    false: false,
    nil: null,
};

//globalEnv
Object.keys(initialConfig).forEach((key) => {
    globalEnv.set(key, initialConfig[key]);
});

// --- 4. EVALUATOR ---
function evaluate(x: Expression, env: Env): any {
    if (typeof x === "string") {
        if (x.startsWith('"') && x.endsWith('"')) {
            return x.slice(1, -1);
        }
        return env.get(x);
    }

    if (typeof x === "number") {
        return x;
    }

    if (Array.isArray(x)) {
        if (x.length === 0) return null;
        const [op, ...args] = x;

        if (op === "def") {
            const [name, valueExpr] = args;
            if (typeof name !== "string")
                throw new Error("Nome de variável inválido");
            const value = evaluate(valueExpr!, env);
            env.set(name, value);
            return value;
        }

        if (op === "if") {
            const [test, thenExpr, elseExpr] = args;
            const condition = evaluate(test!, env);
            if (condition !== false && condition !== null) {
                return evaluate(thenExpr!, env);
            }
            return elseExpr ? evaluate(elseExpr!, env) : null;
        }

        if (op === "fn") {
            const [params, body] = args;
            return {
                params: params as string[],
                body: body!,
                env: env,
            } as UserFunction;
        }

        const func = evaluate(op!, env);

        const argsVal = args.map((arg) => evaluate(arg!, env));

        if (typeof func === "function") {
            return func(...argsVal);
        }

        if (
            func &&
            typeof func === "object" &&
            "params" in func &&
            "body" in func
        ) {
            const userFunc = func as UserFunction;

            const functionEnv = new Env(
                userFunc.env, // Pai (Closure)
                userFunc.params, // Nomes dos parâmetros
                argsVal, // Valores passados
            );

            return evaluate(userFunc.body, functionEnv);
        }

        throw new Error(`'${op}' não é uma função válida.`);
    }
}

function run(source: string) {
    const tokens = tokenize(source);

    while (tokens.length > 0) {
        try {
            const ast = parse(tokens);

            evaluate(ast, globalEnv);
        } catch (e) {
            console.error("Erro de execução:", e);
            break;
        }
    }
}

const rawArgs = process.argv.slice(2);

const args = rawArgs.filter((arg) => arg !== "--" && !arg.startsWith("-"));

if (args.length > 0) {
    const filename = args[0];
    const filepath = path.resolve(process.cwd(), filename!);

    console.log(`> Executando: ${filename}`);

    try {
        if (!fs.existsSync(filepath)) {
            throw new Error(`Arquivo não encontrado: ${filepath}`);
        }
        const fileContent = fs.readFileSync(filepath, "utf-8");
        run(fileContent);
    } catch (error: any) {
        console.error(`Erro: ${error.message}`);
    }
} else {
    console.log("-----------------------------------------");
    console.log("Mini-Clojure Interpreter (TypeScript)");
    console.log("-----------------------------------------");
    console.log("Uso: pnpm start -- <arquivo.clj>");
    console.log("Exemplo: pnpm start -- main.clj");
}
