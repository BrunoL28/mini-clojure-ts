import { Env } from "./Environment.js";
import { evaluate } from "./Evaluator.js";
import { trampoline } from "./Trampoline.js";
import { tokenize } from "./Tokenizer.js";
import { parse } from "./Parser.js";
import { ClojureNamespace } from "../types/index.js";
import { ClojureError } from "../errors/ClojureError.js";
import { getHost } from "./Host.js";

/** Nome da var dinâmica que guarda o arquivo em execução. */
export const CURRENT_FILE = "*file*";

export interface ModuleRecord {
    /** Caminho absoluto resolvido do arquivo. */
    path: string;
    /** Env isolado do módulo (filho da raiz, enxerga a stdlib). */
    env: Env;
    /** Handle exposto quando o módulo é requerido com `:as`. */
    namespace: ClojureNamespace;
}

const moduleCache = new Map<string, ModuleRecord>();
const loading = new Set<string>();

/**
 * Limpa o cache de módulos. Usado por testes e pelo `--watch` (futuro).
 */
export function clearModuleCache(): void {
    moduleCache.clear();
    loading.clear();
}

/**
 * Descobre o arquivo em execução no ambiente atual, para resolver
 * caminhos relativos a partir dele.
 *
 * @param {Env} env O ambiente em execução.
 * @return {string | null} Caminho absoluto, ou `null` fora de um arquivo.
 */
export function currentFile(env: Env): string | null {
    try {
        const value = env.get(CURRENT_FILE);
        return typeof value === "string" ? value : null;
    } catch {
        return null;
    }
}

/**
 * Resolve o caminho de um módulo.
 *
 * Caminhos relativos resolvem a partir do diretório do arquivo que fez o
 * `require`; sem arquivo corrente (REPL, `--eval`), a partir do `cwd`.
 * A extensão `.clj` é acrescentada quando ausente.
 *
 * @param {string} spec O caminho informado no `require`/`load-file`.
 * @param {string | null} fromFile O arquivo que está requerendo.
 * @return {string} O caminho absoluto do módulo.
 */
export function resolveModulePath(
    spec: string,
    fromFile: string | null,
): string {
    const host = getHost();
    const withExt = host.extname(spec) === "" ? `${spec}.clj` : spec;
    if (host.isAbsolute(withExt)) return withExt;

    const baseDir = fromFile ? host.dirname(fromFile) : host.cwd();
    return host.resolve(baseDir, withExt);
}

/**
 * Lê e avalia um arquivo `.clj` no ambiente informado.
 *
 * @param {string} absPath Caminho absoluto do arquivo.
 * @param {Env} env O ambiente de execução.
 * @return {any} O valor da última expressão.
 */
export function evaluateFile(absPath: string, env: Env): any {
    const host = getHost();
    if (!host.hasFileSystem) {
        throw new ClojureError(
            `load-file não está disponível neste ambiente (host: ${host.name}).`,
        );
    }
    if (!host.exists(absPath)) {
        throw new ClojureError(`Arquivo não encontrado: ${absPath}`);
    }

    const source = host.readFile(absPath);
    const tokens = tokenize(source, absPath);

    let last: any = null;
    while (tokens.length > 0) {
        last = trampoline(evaluate(parse(tokens), env));
    }
    return last;
}

/**
 * Carrega um módulo com cache: um mesmo arquivo é executado no máximo uma vez
 * por sessão. Cada módulo roda em um `Env` próprio, filho da raiz — enxerga a
 * stdlib, mas não os locais de quem o requereu, e seus `def` não vazam.
 *
 * @param {string} spec O caminho informado no `require`.
 * @param {Env} requiringEnv O ambiente que está requerendo.
 * @throws {ClojureError} Se o arquivo não existir ou houver ciclo de require.
 * @return {ModuleRecord} O registro do módulo (do cache, se já carregado).
 */
export function loadModule(spec: string, requiringEnv: Env): ModuleRecord {
    const host = getHost();
    if (!host.hasFileSystem) {
        throw new ClojureError(
            `require não está disponível neste ambiente (host: ${host.name}).`,
        );
    }

    const absPath = resolveModulePath(spec, currentFile(requiringEnv));

    const cached = moduleCache.get(absPath);
    if (cached) return cached;

    if (loading.has(absPath)) {
        throw new ClojureError(
            `Ciclo de require detectado ao carregar '${absPath}'`,
        );
    }

    if (!getHost().exists(absPath)) {
        throw new ClojureError(
            `Módulo não encontrado: '${spec}' (resolvido para ${absPath})`,
        );
    }

    loading.add(absPath);
    try {
        const moduleEnv = new Env(requiringEnv.root());
        moduleEnv.set(CURRENT_FILE, absPath);

        evaluateFile(absPath, moduleEnv);

        const record: ModuleRecord = {
            path: absPath,
            env: moduleEnv,
            namespace: new ClojureNamespace(
                getHost().basename(absPath, getHost().extname(absPath)),
                absPath,
                moduleEnv,
            ),
        };

        moduleCache.set(absPath, record);
        return record;
    } finally {
        loading.delete(absPath);
    }
}

/**
 * Nomes públicos de um módulo (tudo que ele define, menos as vars internas).
 *
 * @param {ModuleRecord} record O módulo carregado.
 * @return {string[]} Os nomes exportados.
 */
export function moduleExports(record: ModuleRecord): string[] {
    return record.env.ownKeys().filter((key) => key !== CURRENT_FILE);
}
