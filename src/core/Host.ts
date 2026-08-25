import { ClojureError } from "../errors/ClojureError.js";

/**
 * Serviços que dependem do ambiente de execução.
 *
 * Existe para o runtime não importar `fs`/`path` direto: com esses imports no
 * grafo, nenhum bundler consegue empacotar o runtime para o browser (#27).
 * O host do Node é instalado pelos entrypoints de Node; num browser fica o
 * host padrão, que recusa IO com mensagem clara.
 */
export interface Host {
    /** Nome do host, usado nas mensagens de erro. */
    readonly name: string;
    /** `true` quando este host consegue ler e escrever arquivos. */
    readonly hasFileSystem: boolean;

    readFile(filepath: string): string;
    writeFile(filepath: string, content: string): void;
    exists(filepath: string): boolean;

    resolve(...segments: string[]): string;
    join(...segments: string[]): string;
    dirname(filepath: string): string;
    basename(filepath: string, ext?: string): string;
    extname(filepath: string): string;
    isAbsolute(filepath: string): boolean;
    cwd(): string;
}

function unsupported(operation: string): never {
    throw new ClojureError(
        `'${operation}' não está disponível neste ambiente (sem sistema de arquivos). ` +
            `Veja docs/browser.md.`,
    );
}

/**
 * Manipulação de caminho no estilo POSIX, em string pura.
 *
 * O host do Node usa o `node:path` de verdade (para funcionar no Windows);
 * este é o suficiente para o browser, onde os caminhos são virtuais.
 */
const posix = {
    normalize(filepath: string): string {
        const isAbsolute = filepath.startsWith("/");
        const parts: string[] = [];

        for (const segment of filepath.split("/")) {
            if (segment === "" || segment === ".") continue;
            if (segment === "..") {
                const last = parts[parts.length - 1];
                if (parts.length > 0 && last !== "..") parts.pop();
                else if (!isAbsolute) parts.push("..");
                continue;
            }
            parts.push(segment);
        }

        return (isAbsolute ? "/" : "") + parts.join("/");
    },

    join(...segments: string[]): string {
        return posix.normalize(segments.filter(Boolean).join("/"));
    },

    resolve(...segments: string[]): string {
        let resolved = "";
        for (const segment of segments) {
            if (!segment) continue;
            resolved = segment.startsWith("/")
                ? segment
                : `${resolved}/${segment}`;
        }
        return posix.normalize(
            resolved.startsWith("/") ? resolved : `/${resolved}`,
        );
    },

    dirname(filepath: string): string {
        const index = filepath.lastIndexOf("/");
        if (index < 0) return ".";
        if (index === 0) return "/";
        return filepath.slice(0, index);
    },

    basename(filepath: string, ext?: string): string {
        const base = filepath.slice(filepath.lastIndexOf("/") + 1);
        if (ext && base.endsWith(ext) && base !== ext) {
            return base.slice(0, -ext.length);
        }
        return base;
    },

    extname(filepath: string): string {
        const base = posix.basename(filepath);
        const index = base.lastIndexOf(".");
        return index <= 0 ? "" : base.slice(index);
    },
};

/** Host padrão: caminhos funcionam, IO não. É o que vale num browser. */
export const NO_FILESYSTEM_HOST: Host = {
    name: "sem sistema de arquivos",
    hasFileSystem: false,
    readFile: (filepath) => unsupported(`ler '${filepath}'`),
    writeFile: (filepath) => unsupported(`escrever '${filepath}'`),
    exists: () => false,
    resolve: posix.resolve,
    join: posix.join,
    dirname: posix.dirname,
    basename: posix.basename,
    extname: posix.extname,
    isAbsolute: (filepath) => filepath.startsWith("/"),
    cwd: () => "/",
};

let currentHost: Host = NO_FILESYSTEM_HOST;

/**
 * Instala o host do ambiente.
 *
 * @param {Host} host O host a usar.
 */
export function setHost(host: Host): void {
    currentHost = host;
}

/**
 * Host em vigor.
 *
 * @return {Host} O host atual.
 */
export function getHost(): Host {
    return currentHost;
}
