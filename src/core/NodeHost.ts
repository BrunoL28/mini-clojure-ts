import * as fs from "fs";
import * as path from "path";
import { setHost } from "./Host.js";
import type { Host } from "./Host.js";

/**
 * Host de Node: sistema de arquivos real e manipulação de caminho nativa
 * (que, diferente da versão POSIX pura, também funciona no Windows).
 */
export const NODE_HOST: Host = {
    name: "node",
    hasFileSystem: true,
    readFile: (filepath) => fs.readFileSync(filepath, "utf-8"),
    writeFile: (filepath, content) =>
        fs.writeFileSync(filepath, content, "utf-8"),
    exists: (filepath) => fs.existsSync(filepath),
    resolve: (...segments) => path.resolve(...segments),
    join: (...segments) => path.join(...segments),
    dirname: (filepath) => path.dirname(filepath),
    basename: (filepath, ext) => path.basename(filepath, ext),
    extname: (filepath) => path.extname(filepath),
    isAbsolute: (filepath) => path.isAbsolute(filepath),
    cwd: () => process.cwd(),
};

/** Instala o host de Node. Chamado pelos entrypoints que rodam em Node. */
export function installNodeHost(): void {
    setHost(NODE_HOST);
}
