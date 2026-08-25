import { Env } from "./Environment.js";
import { ClojureKeyword } from "../types/index.js";
import { InvalidParamError } from "../errors/InvalidParamError.js";
import { ClojureError } from "../errors/ClojureError.js";

/**
 * Membros que nunca podem ser acessados em modo sandbox.
 *
 * `constructor` é o mais importante: a partir de qualquer objeto,
 * `x.constructor.constructor` chega em `Function`, e daí em `eval`. Bloquear
 * só os globais perigosos sem bloquear isso não bloqueia nada.
 */
const DENIED_MEMBERS = new Set([
    "constructor",
    "prototype",
    "__proto__",
    "__defineGetter__",
    "__defineSetter__",
    "__lookupGetter__",
    "__lookupSetter__",
]);

/**
 * Globais liberados por padrão em modo sandbox: puros, sem acesso a IO,
 * rede, processo ou avaliação dinâmica de código.
 */
export const DEFAULT_ALLOWED_GLOBALS = [
    "Math",
    "Date",
    "JSON",
    "String",
    "Number",
    "Boolean",
    "Array",
    "Object",
    "RegExp",
    "Map",
    "Set",
    "Error",
    "console",
    "parseInt",
    "parseFloat",
    "isNaN",
    "isFinite",
];

export interface InteropPolicy {
    /** Nome legível, usado nas mensagens de erro. */
    readonly name: string;
    /** `true` quando `require`/`load-file` são permitidos. */
    readonly allowModules: boolean;
    /** `true` quando `slurp`/`spit` são permitidos. */
    readonly allowFileIO: boolean;
    /** Resolve o primeiro segmento de um `js/...`. */
    resolveGlobal(name: string): any;
    /** Lança se o membro não puder ser acessado via `.` ou `js/a.b`. */
    checkMember(name: string): void;
}

/** Política padrão: interop irrestrito, com acesso direto ao `globalThis`. */
export const OPEN_POLICY: InteropPolicy = {
    name: "aberta",
    allowModules: true,
    allowFileIO: true,
    resolveGlobal(name: string) {
        return (globalThis as any)[name];
    },
    checkMember() {
        /* tudo liberado */
    },
};

export interface SandboxOptions {
    /** Globais liberados. Padrão: `DEFAULT_ALLOWED_GLOBALS`. */
    allow?: string[];
    /** Nomes a acrescentar à lista padrão. */
    extraAllow?: string[];
}

/**
 * Cria uma política restritiva.
 *
 * @param {SandboxOptions} [opts] Ajustes da whitelist.
 * @return {InteropPolicy} A política de sandbox.
 */
export function createSandboxPolicy(opts: SandboxOptions = {}): InteropPolicy {
    const allowed = new Set([
        ...(opts.allow ?? DEFAULT_ALLOWED_GLOBALS),
        ...(opts.extraAllow ?? []),
    ]);

    return {
        name: "sandbox",
        allowModules: false,
        allowFileIO: false,

        resolveGlobal(name: string) {
            if (!allowed.has(name)) {
                throw new ClojureError(
                    `Sandbox: acesso a 'js/${name}' bloqueado. Liberados: ${[...allowed].sort().join(", ")}`,
                );
            }
            return (globalThis as any)[name];
        },

        checkMember(name: string) {
            if (DENIED_MEMBERS.has(name)) {
                throw new ClojureError(
                    `Sandbox: acesso ao membro '${name}' bloqueado.`,
                );
            }
        },
    };
}

// A política mora fora do ambiente, numa WeakMap indexada pela raiz. Guardá-la
// dentro do `Env` deixaria o código avaliado sobrescrevê-la com um `def`.
const policies = new WeakMap<Env, InteropPolicy>();

/**
 * Associa uma política ao ambiente (a raiz da cadeia).
 *
 * @param {Env} env O ambiente.
 * @param {InteropPolicy} policy A política a aplicar.
 */
export function setInteropPolicy(env: Env, policy: InteropPolicy): void {
    policies.set(env.root(), policy);
}

/**
 * Política em vigor para um ambiente. Sem política registrada, o interop é
 * aberto — o comportamento histórico.
 *
 * @param {Env} env O ambiente.
 * @return {InteropPolicy} A política em vigor.
 */
export function getInteropPolicy(env: Env): InteropPolicy {
    return policies.get(env.root()) ?? OPEN_POLICY;
}

/**
 * Resolve um símbolo `js/...`, aceitando caminhos com ponto
 * (`js/Math.PI`, `js/console.log`).
 *
 * @param {string} pathExpr O caminho depois do `js/`.
 * @param {Env} env O ambiente, de onde sai a política.
 * @throws {InvalidParamError} Se algum segmento não existir.
 * @return {any} O valor resolvido.
 */
export function resolveJsSymbol(pathExpr: string, env: Env): any {
    const policy = getInteropPolicy(env);
    const [head, ...rest] = pathExpr.split(".");

    if (head === undefined || head === "") {
        throw new InvalidParamError(`Símbolo 'js/${pathExpr}' inválido.`);
    }

    let value = policy.resolveGlobal(head);
    if (value === undefined) {
        throw new InvalidParamError(
            `Global JavaScript 'js/${head}' não encontrado.`,
        );
    }

    let walked = head;
    for (const segment of rest) {
        policy.checkMember(segment);
        if (value === null || value === undefined) {
            throw new InvalidParamError(
                `Não é possível ler '${segment}' de 'js/${walked}' (é nil).`,
            );
        }
        value = value[segment];
        walked += `.${segment}`;
        if (value === undefined) {
            throw new InvalidParamError(
                `Propriedade 'js/${walked}' não encontrada.`,
            );
        }
    }

    return value;
}

/**
 * Normaliza o membro passado ao operador `.`: aceita keyword (`:log`) ou
 * string (`"log"`).
 *
 * @param {any} member O membro informado.
 * @return {string} O nome da propriedade.
 */
export function memberName(member: any): string {
    if (member instanceof ClojureKeyword) return member.value.slice(1);

    const asString = String(member);
    if (asString.startsWith('"') && asString.endsWith('"')) {
        return asString.slice(1, -1);
    }
    return asString;
}

/**
 * Implementa o operador `.`: propriedade quando o valor não é função,
 * chamada quando é.
 *
 * @param {InteropPolicy} policy A política em vigor.
 * @param {any} member O membro (keyword ou string).
 * @param {any} target O alvo.
 * @param {any[]} args Argumentos, quando for chamada de método.
 * @return {any} O valor da propriedade ou o retorno do método.
 */
export function accessMember(
    policy: InteropPolicy,
    member: any,
    target: any,
    args: any[],
): any {
    if (target === undefined || target === null) {
        throw new InvalidParamError(
            "Alvo do operador '.' é nulo ou indefinido.",
        );
    }

    const name = memberName(member);
    policy.checkMember(name);

    const value = target[name];
    if (typeof value === "function") return value.apply(target, args);
    return value;
}

/**
 * Lê uma propriedade **sem** chamá-la, mesmo que seja função — é o que
 * permite passar um método como valor.
 *
 * @param {InteropPolicy} policy A política em vigor.
 * @param {any} member O membro (keyword ou string).
 * @param {any} target O alvo.
 * @return {any} O valor da propriedade.
 */
export function readProperty(
    policy: InteropPolicy,
    member: any,
    target: any,
): any {
    if (target === undefined || target === null) {
        throw new InvalidParamError(
            "Alvo do operador '.-' é nulo ou indefinido.",
        );
    }

    const name = memberName(member);
    policy.checkMember(name);
    return target[name];
}

/**
 * Implementa `new`.
 *
 * @param {InteropPolicy} policy A política em vigor.
 * @param {any} ClassRef O construtor.
 * @param {any[]} args Os argumentos.
 * @return {any} A instância.
 */
export function construct(
    policy: InteropPolicy,
    ClassRef: any,
    args: any[],
): any {
    if (typeof ClassRef !== "function") {
        throw new InvalidParamError(
            "O primeiro argumento de 'new' deve ser uma classe/função construtora.",
        );
    }
    // `Function` como construtor é `eval` por outro nome.
    policy.checkMember(ClassRef.name ?? "");
    if (policy !== OPEN_POLICY && ClassRef === Function) {
        throw new ClojureError("Sandbox: 'new Function' bloqueado.");
    }
    return new ClassRef(...args);
}
