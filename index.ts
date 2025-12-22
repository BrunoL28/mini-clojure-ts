// --- TIPOS ---
// Aqui será definido o que nosso interpretador consegue entender

type Atom = string | number;
type Expression = Atom | List;
interface List extends Array<Expression> {}

// --- 1. Tokenizer (Léxico) ---
// Transforma a string de código em uma lista de tokens (palavras e símbolos)
function tokenize(input: string): string[] {
    return input
        .replace(/\(/g, " ( ")
        .replace(/\)/g, " ) ")
        .trim()
        .split(/\s+/);
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

// --- 3. ENVIRONMENT (Ambiente) ---
// Define as funções básicas que a linguagem conhece (soma, subtração, etc.)
const standardEnv: { [key: string]: Function | any } = {
    "+": (...args: number[]) => args.reduce((a, b) => a + b, 0),
    "-": (a: number, b: number) => a - b,
    "*": (...args: number[]) => args.reduce((a, b) => a * b, 1),
    "/": (a: number, b: number) => a / b,

    ">": (a: number, b: number) => a > b,
    "<": (a: number, b: number) => a < b,
    "=": (a: any, b: any) => a === b,
    ">=": (a: number, b: number) => a >= b,
    "<=": (a: number, b: number) => a <= b,

    print: (...args: any[]) => {
        console.log(...args);
        return null;
    },
    true: true,
    false: false,
    nil: null,
};

// --- 4. EVALUATOR (Avaliador) ---
// Executa o código processado.
function evaluate(x: Expression, env: any): any {
    if (typeof x === "string") {
        if (x in env) {
            return env[x];
        }
        throw new Error(`Símbolo '${x}' não definido.`);
    }

    if (typeof x === "number") {
        return x;
    }

    if (Array.isArray(x)) {
        if (x.length === 0) return null;

        const [op, ...args] = x;

        if (op === "def") {
            const [name, valueExpr] = args;
            if (typeof name !== "string") {
                throw new Error(
                    "O primeiro argumento de 'def' deve ser um símbolo (nome).",
                );
            }
            if (valueExpr === undefined) {
                throw new Error("'def' requer um valor.");
            }
            const value = evaluate(valueExpr, env);
            env[name] = value;
            return value;
        }

        if (op === "if") {
            const [test, thenExpr, elseExpr] = args;

            if (test === undefined) {
                throw new Error("'if' requer uma condição de teste.");
            }

            if (thenExpr === undefined) {
                throw new Error("'if' requer uma expressão then.");
            }

            const condition = evaluate(test, env);

            if (condition !== false && condition !== null) {
                return evaluate(thenExpr, env);
            } else {
                return elseExpr ? evaluate(elseExpr, env) : null;
            }
        }

        if (op === undefined) {
            throw new Error("Expressão vazia.");
        }

        const func = evaluate(op, env);

        const evaluatedArgs = args.map((arg) => evaluate(arg, env));

        if (typeof func === "function") {
            return func(...evaluatedArgs);
        } else {
            throw new Error(`'${op}' não é uma função.`);
        }
    }
}

// --- TESTE ---
const program = [
    "(def x 10)", // 1. Define x como 10
    "(def y 20)", // 2. Define y como 20
    "(print (+ x y))", // 3. Imprime 30
    "(if (> x y) (print x) (print y))", // 4. Se x > y imprime x, senão y
    "(def res (if (< x y) 100 200))", // 5. Teste inline
    "(print res)", // 6. Deve imprimir 100
];

console.log("--- Iniciando Execução ---");

// Executa linha por linha mantendo o mesmo 'standardEnv' (memória)
for (const line of program) {
    console.log(`> ${line}`);
    try {
        const tokens = tokenize(line);
        const ast = parse(tokens);
        evaluate(ast, standardEnv);
    } catch (e) {
        console.error("Erro:", e);
    }
}
