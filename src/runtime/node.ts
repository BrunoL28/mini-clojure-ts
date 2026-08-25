/**
 * Runtime para Node.
 *
 * É o `./index.js` mais a instalação do host de sistema de arquivos, o que
 * habilita `slurp`, `spit` e a resolução de módulos. Existe separado porque
 * `./index.js` precisa continuar livre de `fs`/`path` para poder ser
 * empacotado para o browser (#27).
 */
import { installNodeHost } from "../core/NodeHost.js";

installNodeHost();

export * from "./index.js";
