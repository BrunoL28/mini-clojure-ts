import type { Expression } from "../types/index.js";
import type { UserFunction } from "../types/index.js";
import {
    ClojureVector,
    ClojureKeyword,
    ClojureMap,
    ClojureMacro,
    ClojureAtom,
    ClojureSymbol,
    ClojureNamespace,
} from "../types/index.js";
import { Env } from "./Environment.js";
import { InvalidParamError } from "../errors/InvalidParamError.js";
import { ClojureReferenceError } from "../errors/ReferenceError.js";
import { ClojureError } from "../errors/ClojureError.js";
import { prStr } from "./Printer.js";
import { resolveJsSymbol, getInteropPolicy } from "./Interop.js";
import { checkTimeLimit } from "./Limits.js";
import { traceEnter, traceExit, traceMacroexpand, isTracing } from "./Trace.js";
import { Bounce, trampoline } from "./Trampoline.js";
import {
    loadModule,
    moduleExports,
    evaluateFile,
    resolveModulePath,
    currentFile,
} from "./Modules.js";

/**
 * Formas tratadas diretamente pelo avaliador.
 *
 * Manter isto sincronizado com o `switch` dentro de `evaluate`: um nome que
 * falte aqui é tratado como chamada de função comum.
 */
const SPECIAL_FORMS = new Set([
    "macroexpand-1",
    "macroexpand",
    "defn",
    "def",
    "if",
    "when",
    "when-not",
    "and",
    "or",
    "cond",
    "->",
    "->>",
    "time",
    "require",
    "load-file",
    "quote",
    "do",
    "fn",
    "let",
    "try",
    "defmacro",
    "quasiquote",
]);

function evalQuasiquote(ast: any, env: Env): any {
    if (Array.isArray(ast)) {
        if (ast.length === 0) return [];

        const op = ast[0];
        const isUnquote =
            (op instanceof ClojureSymbol && op.value === "unquote") ||
            op === "unquote";

        if (isUnquote) {
            return evaluate(ast[1], env);
        }

        return ast.map((item) => evalQuasiquote(item, env));
    }
    if (ast instanceof ClojureVector) {
        return ClojureVector.fromArray(
            ast.map((item) => evalQuasiquote(item, env)),
        );
    }
    if (ast instanceof ClojureSymbol) {
        return ast;
    }
    return ast;
}

function validateBindingShape(shape: any) {
    if (shape instanceof ClojureSymbol) return;
    if (typeof shape === "string") {
        if (shape === "&") return;
        throw new InvalidParamError(
            `Parâmetro inválido: string '${shape}' não permitida. Use símbolos.`,
        );
    }
    if (shape instanceof ClojureVector || Array.isArray(shape)) {
        for (const item of shape) validateBindingShape(item);
        return;
    }
    if (shape instanceof ClojureMap) {
        for (const [key, val] of shape) {
            if (key instanceof ClojureKeyword) {
                if (key.value === ":keys") {
                    if (!(val instanceof ClojureVector) && !Array.isArray(val))
                        throw new InvalidParamError(":keys requer vetor.");
                    return;
                }
                if (key.value === ":as") {
                    if (!(val instanceof ClojureSymbol))
                        throw new InvalidParamError(":as requer símbolo.");
                    return;
                }
                if (key.value === ":or") {
                    if (!(val instanceof ClojureMap))
                        throw new InvalidParamError(":or requer um mapa.");
                    return;
                }
                throw new InvalidParamError(
                    `Keyword '${key}' desconhecida em binding.`,
                );
            }
            validateBindingShape(key);
        }
        return;
    }
    throw new InvalidParamError(`Forma de binding inválida: ${shape}`);
}

function resolveDefault(
    env: Env,
    defaults: ClojureMap | null,
    keySymbol: ClojureSymbol,
): any {
    if (!defaults) return null;
    // O HAMT já indexa símbolos por valor, então `get` basta: não é preciso
    // varrer as entradas.
    const defaultExpr = defaults.get(keySymbol);

    if (defaultExpr !== undefined) {
        return trampoline(evaluate(defaultExpr, env));
    }

    return null;
}

export function bind(env: Env, shape: any, value: any) {
    let key = shape;
    if (shape instanceof ClojureSymbol) key = shape.value;

    if (typeof key === "string") {
        if (key === "&") return;
        env.set(key, value);
        return;
    }

    if (Array.isArray(shape) || shape instanceof ClojureVector) {
        if (
            value !== null &&
            !Array.isArray(value) &&
            !(value instanceof ClojureVector)
        ) {
            throw new InvalidParamError(
                `Destructuring: esperava sequência, recebeu ${value}`,
            );
        }

        const listValue = value === null ? [] : value;

        let valIndex = 0;
        for (let i = 0; i < shape.length; i++) {
            const param = shape[i];
            const paramName =
                param instanceof ClojureSymbol ? param.value : param;

            if (paramName === "&") {
                const nextParam = shape[i + 1];
                if (!nextParam)
                    throw new InvalidParamError("Esperado símbolo após &");

                const remaining = listValue.slice(valIndex);
                bind(env, nextParam, ClojureVector.fromArray(remaining));
                break;
            }

            const valToBind =
                valIndex < listValue.length ? listValue[valIndex] : null;
            bind(env, param, valToBind);
            valIndex++;
        }
        return;
    }

    if (shape instanceof ClojureMap) {
        if (value !== null && !(value instanceof ClojureMap)) {
            throw new InvalidParamError(
                `Destructuring: esperava mapa, recebeu ${value}`,
            );
        }
        const mapValue = value === null ? new ClojureMap() : value;
        let defaults: ClojureMap | null = null;
        for (const [k, v] of shape) {
            if (k instanceof ClojureKeyword) {
                if (k.value === ":or") {
                    defaults = v as ClojureMap;
                } else if (k.value === ":as") {
                    bind(env, v, mapValue);
                }
            }
        }

        for (const [target, source] of shape) {
            if (target instanceof ClojureKeyword) {
                if (target.value === ":or" || target.value === ":as") continue;
                if (target.value === ":keys") {
                    const keysVector = source as any[];
                    for (const sym of keysVector) {
                        if (sym instanceof ClojureSymbol) {
                            const lookupKey = new ClojureKeyword(
                                ":" + sym.value,
                            );
                            let val = mapValue.get(lookupKey);
                            if (val === undefined) {
                                const def = resolveDefault(env, defaults, sym);
                                val = def !== null ? def : null;
                            }

                            bind(env, sym, val);
                        }
                    }
                    continue;
                }
            }

            const lookupKey = source;
            let val = mapValue.get(lookupKey);

            if (val === undefined && target instanceof ClojureSymbol) {
                const def = resolveDefault(env, defaults, target);
                val = def !== null ? def : null;
            }

            bind(env, target, val ?? null);
        }
        return;
    }

    throw new InvalidParamError(`Forma inválida: ${shape}`);
}

export function macroexpand1(form: any, env: Env): any {
    if (!Array.isArray(form) && !(form instanceof ClojureVector)) return form;
    if (form.length === 0) return form;

    const op = form[0];

    let macroVal = null;
    try {
        macroVal = trampoline(evaluate(op, env));
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
        return form;
    }

    if (macroVal instanceof ClojureMacro) {
        const args = form.slice(1);
        const macroEnv = new Env(macroVal.env, macroVal.params, args);
        const expanded = trampoline(evaluate(macroVal.body, macroEnv));

        traceMacroexpand(form, expanded);

        if (
            expanded &&
            typeof expanded === "object" &&
            "loc" in form &&
            !expanded.loc
        ) {
            expanded.loc = (form as any).loc;
        }

        return expanded;
    }

    return form;
}

export function evaluate(x: Expression, env: Env): any {
    // Lido uma vez: com tracing desligado o custo é uma comparação por forma.
    const rastreando = isTracing();
    let rastreandoEsteQuadro = false;

    try {
        if (x instanceof ClojureSymbol) {
            if (x.value.startsWith("js/")) {
                return resolveJsSymbol(x.value.slice(3), env);
            }

            // alias/membro de um módulo requerido com :as (ex.: math/soma).
            // O `/` sozinho é a divisão, então exigimos algo antes e depois.
            const slash = x.value.indexOf("/");
            if (slash > 0 && slash < x.value.length - 1) {
                const aliasName = x.value.slice(0, slash);
                const memberName = x.value.slice(slash + 1);

                let aliasValue: any;
                try {
                    aliasValue = env.get(aliasName);
                } catch {
                    aliasValue = undefined;
                }

                if (aliasValue instanceof ClojureNamespace) {
                    if (!aliasValue.env.hasOwn(memberName)) {
                        throw new ClojureError(
                            `'${memberName}' não é definido no módulo '${aliasName}' (${aliasValue.path})`,
                            x.loc,
                        );
                    }
                    return aliasValue.env.getOwn(memberName);
                }
            }

            try {
                return env.get(x.value);
            } catch (e) {
                if (e instanceof ClojureReferenceError && !e.loc) {
                    e.loc = x.loc;
                }
                throw e;
            }
        }

        if (typeof x === "string") return x;
        if (typeof x === "number") return x;
        if (typeof x === "boolean") return x;
        if (x === null) return null;
        if (x instanceof ClojureKeyword) return x;
        if (x instanceof ClojureAtom) return x;

        if (x instanceof ClojureMap) {
            let newMap = new ClojureMap();
            if (x.loc) newMap.loc = x.loc;

            for (const [key, val] of x) {
                const evalKey = trampoline(evaluate(key, env));
                const evalVal = trampoline(evaluate(val, env));
                newMap = newMap.assoc(evalKey, evalVal);
            }
            return newMap;
        }

        if (x instanceof ClojureVector) {
            const evaluatedItems = x.map((item) =>
                trampoline(evaluate(item, env)),
            );
            const v = ClojureVector.fromArray(evaluatedItems);
            if (x.loc) v.loc = x.loc;
            return v;
        }

        if (Array.isArray(x)) {
            if (x.length === 0) return null;

            // Único ponto de checagem do limite de tempo: toda forma composta
            // passa por aqui, inclusive as reentradas da recursão de cauda.
            checkTimeLimit();
            if (rastreando) {
                traceEnter(x);
                rastreandoEsteQuadro = true;
            }

            const [op, ...args] = x;

            let opName = op;
            if (op instanceof ClojureSymbol) opName = op.value;

            // Uma única consulta em Set substitui a cadeia de ~25 comparações
            // de string que toda chamada comum percorria antes de chegar no
            // caminho de aplicação de função.
            if (typeof opName === "string" && SPECIAL_FORMS.has(opName)) {
                if (opName === "macroexpand-1") {
                    if (args.length !== 1)
                        throw new InvalidParamError(
                            "macroexpand-1 requer 1 argumento",
                        );
                    const formToExpand = trampoline(evaluate(args[0]!, env));
                    return macroexpand1(formToExpand, env);
                }

                if (opName === "macroexpand") {
                    if (args.length !== 1)
                        throw new InvalidParamError(
                            "macroexpand requer 1 argumento",
                        );
                    let currentForm = trampoline(evaluate(args[0]!, env));
                    let expanded = macroexpand1(currentForm, env);

                    while (expanded !== currentForm) {
                        currentForm = expanded;
                        expanded = macroexpand1(currentForm, env);
                    }
                    return expanded;
                }

                if (opName === "defn") {
                    const [name, params, ...body] = args;

                    let fnName = name;
                    if (name instanceof ClojureSymbol) fnName = name.value;

                    if (typeof fnName !== "string") {
                        throw new InvalidParamError(
                            "O primeiro argumento de 'defn' deve ser um símbolo (nome).",
                        );
                    }

                    if (!(params instanceof ClojureVector)) {
                        throw new InvalidParamError(
                            "O segundo argumento de 'defn' deve ser um VETOR [...] de parâmetros.",
                        );
                    }

                    validateBindingShape(params);

                    let fnBody: any = null;
                    if (body.length > 1) {
                        fnBody = ["do", ...body];
                    } else if (body.length === 1) {
                        fnBody = body[0];
                    }

                    const fnExpr = ["fn", params, fnBody];
                    const fnValue = trampoline(evaluate(fnExpr, env));

                    env.set(fnName, fnValue);

                    return fnName;
                }

                if (opName === "def") {
                    const [name, valueExpr] = args;
                    let varName = name;
                    if (name instanceof ClojureSymbol) varName = name.value;

                    if (typeof varName !== "string")
                        throw new InvalidParamError(
                            "Nome de variável inválido no def",
                        );

                    const value = trampoline(evaluate(valueExpr!, env));
                    env.set(varName, value);
                    return value;
                }

                if (opName === "if") {
                    const [test, thenExpr, elseExpr] = args;
                    const condition = trampoline(evaluate(test!, env));
                    if (condition !== false && condition !== null)
                        return evaluate(thenExpr!, env);
                    return elseExpr ? evaluate(elseExpr!, env) : null;
                }

                // --- MACROS UTILITÁRIAS (R3/E3) ---
                // Implementadas como formas especiais para garantir avaliação
                // preguiçosa (short-circuit) dos argumentos.

                if (opName === "when" || opName === "when-not") {
                    if (args.length === 0)
                        throw new InvalidParamError(
                            `${opName} requer uma condição`,
                        );

                    const test = trampoline(evaluate(args[0]!, env));
                    const isTrue = test !== false && test !== null;
                    const shouldRun = opName === "when" ? isTrue : !isTrue;
                    if (!shouldRun) return null;

                    const body = args.slice(1);
                    for (let i = 0; i < body.length - 1; i++) {
                        trampoline(evaluate(body[i]!, env));
                    }
                    if (body.length > 0)
                        return evaluate(body[body.length - 1]!, env);
                    return null;
                }

                if (opName === "and") {
                    if (args.length === 0) return true;
                    for (let i = 0; i < args.length - 1; i++) {
                        const value = trampoline(evaluate(args[i]!, env));
                        if (value === false || value === null) return value;
                    }
                    return evaluate(args[args.length - 1]!, env);
                }

                if (opName === "or") {
                    if (args.length === 0) return null;
                    for (let i = 0; i < args.length - 1; i++) {
                        const value = trampoline(evaluate(args[i]!, env));
                        if (value !== false && value !== null) return value;
                    }
                    return evaluate(args[args.length - 1]!, env);
                }

                if (opName === "cond") {
                    if (args.length % 2 !== 0) {
                        throw new InvalidParamError(
                            "cond requer um número par de formas (teste expressão)",
                        );
                    }
                    for (let i = 0; i < args.length; i += 2) {
                        const test = trampoline(evaluate(args[i]!, env));
                        if (test !== false && test !== null) {
                            return evaluate(args[i + 1]!, env);
                        }
                    }
                    return null;
                }

                if (opName === "->" || opName === "->>") {
                    if (args.length === 0) {
                        throw new InvalidParamError(
                            `${opName} requer ao menos o valor inicial`,
                        );
                    }

                    const threadLast = opName === "->>";
                    let form: any = args[0];

                    for (let i = 1; i < args.length; i++) {
                        const step = args[i];
                        const isCallForm =
                            Array.isArray(step) &&
                            !(step instanceof ClojureVector) &&
                            step.length > 0;

                        let next: any[];
                        if (isCallForm) {
                            const [head, ...rest] = step as any[];
                            next = threadLast
                                ? [head, ...rest, form]
                                : [head, form, ...rest];
                        } else {
                            next = [step, form];
                        }

                        const loc = (step as any)?.loc ?? (x as any).loc;
                        if (loc) (next as any).loc = loc;
                        form = next;
                    }

                    return evaluate(form, env);
                }

                // --- IO/UTIL (R3/E4) ---

                if (opName === "time") {
                    if (args.length !== 1) {
                        throw new InvalidParamError(
                            "time requer exatamente 1 expressão",
                        );
                    }
                    const startedAt = performance.now();
                    const value = trampoline(evaluate(args[0]!, env));
                    const elapsed = performance.now() - startedAt;
                    console.log(`Elapsed time: ${elapsed.toFixed(4)} msecs`);
                    return value;
                }

                // --- MÓDULOS (R4/E1) ---

                if (opName === "require") {
                    const [specExpr, ...opts] = args;
                    if (specExpr === undefined) {
                        throw new InvalidParamError(
                            'require requer o caminho do módulo: (require "./math.clj")',
                        );
                    }

                    const spec = trampoline(evaluate(specExpr, env));
                    if (typeof spec !== "string") {
                        throw new InvalidParamError(
                            `require espera o caminho como string, recebeu ${prStr(spec, true)}`,
                        );
                    }

                    if (!getInteropPolicy(env).allowModules) {
                        throw new ClojureError(
                            "Sandbox: 'require' bloqueado (dá acesso ao sistema de arquivos).",
                            (x as any).loc,
                        );
                    }

                    const record = loadModule(spec, env);

                    if (opts.length === 0) {
                        // Sem :as, os nomes públicos do módulo entram no env atual.
                        for (const name of moduleExports(record)) {
                            env.set(name, record.env.getOwn(name));
                        }
                        return null;
                    }

                    const [asKeyword, aliasSymbol, ...extra] = opts;
                    const isAs =
                        (asKeyword instanceof ClojureKeyword &&
                            asKeyword.value === ":as") ||
                        asKeyword === ":as";

                    if (
                        !isAs ||
                        aliasSymbol === undefined ||
                        extra.length > 0
                    ) {
                        throw new InvalidParamError(
                            'Forma inválida de require. Use (require "./math.clj") ou (require "./math.clj" :as math)',
                        );
                    }

                    let aliasName = aliasSymbol;
                    if (aliasSymbol instanceof ClojureSymbol) {
                        aliasName = aliasSymbol.value;
                    }
                    if (typeof aliasName !== "string") {
                        throw new InvalidParamError(
                            ":as requer um símbolo como alias",
                        );
                    }

                    env.set(aliasName, record.namespace);
                    return null;
                }

                if (opName === "load-file") {
                    if (args.length !== 1) {
                        throw new InvalidParamError(
                            'load-file requer 1 argumento: (load-file "./setup.clj")',
                        );
                    }

                    const spec = trampoline(evaluate(args[0]!, env));
                    if (typeof spec !== "string") {
                        throw new InvalidParamError(
                            `load-file espera o caminho como string, recebeu ${prStr(spec, true)}`,
                        );
                    }

                    if (!getInteropPolicy(env).allowModules) {
                        throw new ClojureError(
                            "Sandbox: 'load-file' bloqueado (dá acesso ao sistema de arquivos).",
                            (x as any).loc,
                        );
                    }

                    // Diferente de require: executa no env ATUAL e sempre reexecuta.
                    const absPath = resolveModulePath(spec, currentFile(env));
                    return evaluateFile(absPath, env);
                }

                if (opName === "quote") return args[0];

                if (opName === "do") {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const result = null;
                    for (let i = 0; i < args.length - 1; i++) {
                        trampoline(evaluate(args[i]!, env));
                    }
                    if (args.length > 0) {
                        return evaluate(args[args.length - 1]!, env);
                    }
                    return null;
                }

                if (opName === "fn") {
                    const [params, body] = args;

                    if (!(params instanceof ClojureVector)) {
                        throw new InvalidParamError(
                            "Os parâmetros de 'fn' devem ser um vetor.",
                        );
                    }
                    validateBindingShape(params);

                    return {
                        params: params as any[],
                        body: body!,
                        env: env,
                    } as UserFunction;
                }

                if (opName === "let") {
                    const [bindings, ...body] = args;
                    if (!Array.isArray(bindings))
                        throw new InvalidParamError("let requer bindings");

                    if (bindings.length % 2 !== 0) {
                        throw new InvalidParamError(
                            "let requer número par de itens no vetor de bindings",
                        );
                    }

                    const letEnv = new Env(env);
                    for (let i = 0; i < bindings.length; i += 2) {
                        const shape = bindings[i];
                        const valExpr = bindings[i + 1];
                        const val = trampoline(evaluate(valExpr!, letEnv));
                        bind(letEnv, shape, val);
                    }

                    for (let i = 0; i < body.length - 1; i++) {
                        trampoline(evaluate(body[i]!, letEnv));
                    }
                    if (body.length > 0)
                        return evaluate(body[body.length - 1]!, letEnv);
                    return null;
                }

                if (opName === "try") {
                    const tryBody = [];
                    let catchClause = null;

                    for (const arg of args) {
                        const isCatch =
                            Array.isArray(arg) &&
                            arg.length > 0 &&
                            ((arg[0] instanceof ClojureSymbol &&
                                arg[0].value === "catch") ||
                                arg[0] === "catch");

                        if (isCatch) {
                            catchClause = arg;
                        } else {
                            tryBody.push(arg);
                        }
                    }

                    try {
                        let result = null;
                        for (const expr of tryBody) {
                            result = trampoline(evaluate(expr!, env));
                        }
                        return result;
                    } catch (e: any) {
                        if (catchClause) {
                            // eslint-disable-next-line @typescript-eslint/no-unused-vars
                            const [_, errVarName, errBody] = catchClause;
                            let varName = errVarName;
                            if (errVarName instanceof ClojureSymbol)
                                varName = errVarName.value;

                            if (typeof varName !== "string") {
                                throw new InvalidParamError(
                                    "Nome da variável de erro inválido no catch",
                                );
                            }

                            const errorMessage =
                                e instanceof Error ? e.message : String(e);

                            const catchEnv = new Env(
                                env,
                                [varName],
                                [errorMessage],
                            );

                            return evaluate(errBody!, catchEnv);
                        }
                        throw e;
                    }
                }

                if (opName === "defmacro") {
                    const [name, params, body] = args;
                    let macroName = name;
                    if (name instanceof ClojureSymbol) macroName = name.value;

                    if (typeof macroName !== "string")
                        throw new InvalidParamError("Nome de macro inválido");

                    const paramNames = (params as any[]).map((p) =>
                        p instanceof ClojureSymbol ? p.value : p,
                    );

                    const macro = new ClojureMacro(paramNames, body!, env);
                    env.set(macroName, macro);
                    return macroName;
                }

                if (opName === "quasiquote") {
                    return evalQuasiquote(args[0], env);
                }
            }

            const func = trampoline(evaluate(op!, env));

            if (func instanceof ClojureMacro) {
                const macroEnv = new Env(func.env, func.params, args);
                const expandedCode = trampoline(evaluate(func.body, macroEnv));
                // Caminho normal de uso de macro — não passa por
                // `macroexpand1`, então o trace precisa do gancho aqui também.
                traceMacroexpand(x, expandedCode);
                return evaluate(expandedCode, env);
            }

            const argsVal = args.map((arg) => trampoline(evaluate(arg!, env)));

            if (func instanceof ClojureKeyword) {
                const [target, notFound] = argsVal;

                if (target === null || target === undefined) {
                    return notFound ?? null;
                }

                if (target instanceof ClojureMap) {
                    const value = target.get(func);
                    return value === undefined ? (notFound ?? null) : value;
                }

                return notFound ?? null;
            }

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
                const functionEnv = new Env(userFunc.env, [], []);
                const paramDefs = userFunc.params;
                bind(functionEnv, paramDefs, argsVal);
                return new Bounce(() => evaluate(userFunc.body, functionEnv));
            }

            throw new InvalidParamError(
                `'${opName}' (${typeof func}) não é uma função válida.`,
            );
        }

        return x;
    } catch (e: any) {
        if (e instanceof ClojureError) {
            if (!e.loc && (x as any).loc) {
                e.loc = (x as any).loc;
            }
        }
        throw e;
    } finally {
        if (rastreandoEsteQuadro) traceExit();
    }
}
