import { prStr } from "./Printer.js";

/**
 * Tracing e profiling do avaliador.
 *
 * Desligado, o custo é uma comparação com `null` por forma avaliada — por isso
 * o estado é um módulo só, e não um objeto passado adiante.
 */

export interface TraceOptions {
    /** Imprime cada forma composta avaliada. */
    evalForms?: boolean;
    /** Imprime cada expansão de macro. */
    macroexpand?: boolean;
    /** Conta formas e mede o tempo total. */
    profile?: boolean;
    /** Profundidade máxima impressa no trace. */
    maxDepth?: number;
}

interface TraceState {
    options: TraceOptions;
    depth: number;
    /** Contagem por operador (`if`, `let`, chamada, ...). */
    counts: Map<string, number>;
    total: number;
    startedAt: number;
}

let state: TraceState | null = null;

/** Recorta a forma para o trace não virar uma parede de texto. */
function resumo(form: any, max = 72): string {
    const texto = prStr(form, true);
    return texto.length <= max ? texto : `${texto.slice(0, max - 1)}…`;
}

/** Nome do operador de uma forma, para o perfil agrupar por tipo. */
function rotulo(form: any): string {
    if (!Array.isArray(form) || form.length === 0) return "(vazio)";
    const head = form[0];
    const nome =
        head && typeof head === "object" && "value" in head
            ? String((head as any).value)
            : typeof head === "string"
              ? head
              : "(expressão)";
    return nome;
}

/**
 * Liga o tracing.
 *
 * @param {TraceOptions} options O que registrar.
 */
export function startTracing(options: TraceOptions): void {
    state = {
        options,
        depth: 0,
        counts: new Map(),
        total: 0,
        startedAt: performance.now(),
    };
}

/** Desliga o tracing. */
export function stopTracing(): void {
    state = null;
}

/** Indica se há tracing ativo. */
export function isTracing(): boolean {
    return state !== null;
}

/**
 * Registra a entrada numa forma composta.
 *
 * @param {any} form A forma sendo avaliada.
 */
export function traceEnter(form: any): void {
    if (state === null) return;

    if (state.options.profile) {
        state.total++;
        const nome = rotulo(form);
        state.counts.set(nome, (state.counts.get(nome) ?? 0) + 1);
    }

    if (state.options.evalForms) {
        const max = state.options.maxDepth ?? Infinity;
        if (state.depth < max) {
            const recuo = "│ ".repeat(state.depth);
            console.error(`\x1b[90m${recuo}▸ ${resumo(form)}\x1b[0m`);
        }
    }

    state.depth++;
}

/** Registra a saída de uma forma. */
export function traceExit(): void {
    if (state === null) return;
    if (state.depth > 0) state.depth--;
}

/**
 * Registra uma expansão de macro.
 *
 * @param {any} antes A forma antes de expandir.
 * @param {any} depois A forma expandida.
 */
export function traceMacroexpand(antes: any, depois: any): void {
    if (state === null || !state.options.macroexpand) return;
    const recuo = "│ ".repeat(state.depth);
    console.error(
        `\x1b[35m${recuo}⤷ macro ${resumo(antes, 48)}\x1b[0m\n` +
            `\x1b[36m${recuo}  → ${resumo(depois, 48)}\x1b[0m`,
    );
}

/**
 * Imprime o resumo do profiler, se estiver ligado.
 *
 * Sai em stderr para não se misturar à saída do programa.
 */
export function printProfile(): void {
    if (state === null || !state.options.profile) return;

    const elapsed = performance.now() - state.startedAt;
    const ordenado = [...state.counts.entries()].sort((a, b) => b[1] - a[1]);

    console.error("\n\x1b[1m— perfil —\x1b[0m");
    console.error(`formas avaliadas: ${state.total.toLocaleString("pt-BR")}`);
    console.error(`tempo total:      ${elapsed.toFixed(2)} ms`);
    if (elapsed > 0) {
        const porSegundo = Math.round((state.total / elapsed) * 1000);
        console.error(
            `formas por segundo: ${porSegundo.toLocaleString("pt-BR")}`,
        );
    }

    console.error("\nmais avaliadas:");
    for (const [nome, quantidade] of ordenado.slice(0, 12)) {
        const pct = ((quantidade / state.total) * 100).toFixed(1);
        console.error(
            `  ${nome.padEnd(20)} ${quantidade.toLocaleString("pt-BR").padStart(10)}  ${pct.padStart(5)}%`,
        );
    }
}
