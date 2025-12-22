// --- TIPOS ---
// Aqui será definido o que nosso interpretador consegue entender

type Atom = string | number;
type Expression = Atom | List;
interface List extends Array<Expression> {};

// --- 1. Tokenizer (Léxico) ---
// Transforma a string de código em uma lista de tokens (palavras e símbolos)
function tokenize(input: string): string[] {
    return input
        .replace(/\(/g, ' ( ')
        .replace(/\)/g, ' ) ')
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

    if (token === '(') {
        const list: List = [];
        while (tokens[0] !== ')') {
            list.push(parse(tokens));
        }
        tokens.shift();
        return list;
    } else if (token === ')') {
        throw new Error("Parênteses ')' inesperado");
    } else {
        const number = parseFloat(token);
        return isNaN(number) ? token : number;
    }
}

// --- 3. ENVIRONMENT (Ambiente) ---
// Define as funções básicas que a linguagem conhece (soma, subtração, etc.)
const standardEnv: { [key: string]: Function } = {
    '+': (...args: number[]) => args.reduce((a, b) => a + b, 0),
    '-': (a: number, b: number) => a - b,
    '*': (...args: number[]) => args.reduce((a, b) => a * b, 1),
    '/': (a: number, b: number) => a / b,
    'print': (...args: any[]) => console.log(...args),
};

// --- 4. EVALUATOR (Avaliador) ---
// Executa o código processado.
function evaluate(x: Expression, env: any): any {
    if (typeof x === 'string') {
        return env[x];
    }

    if (typeof x === 'number') {
        return x;
    }

    if (Array.isArray(x)) {
        const [funcName, ...args] = x;
        
        if (funcName === undefined) {
            throw new Error("Lista vazia não pode ser avaliada");
        }
        
        const func = evaluate(funcName, env);
        
        const evaluatedArgs = args.map((arg) => evaluate(arg, env));
        
        if (typeof func === 'function') {
            return func(...evaluatedArgs);
        } else {
            throw new Error(`'${funcName}' não é uma função.`);
        }
    }
}

// --- TESTE ---
const code = "(print (+ 5 (* 2 3)))";

console.log(`Código Clojure: ${code}`);

try {
    const tokens = tokenize(code);
    const ast = parse(tokens);
    const result = evaluate(ast, standardEnv);
} catch (e) {
  console.error(e);
}