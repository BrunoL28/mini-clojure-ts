// Passos pós-tsc: marca o build CommonJS e gera o bundle de browser.
import * as fs from "fs";
import * as esbuild from "esbuild";

fs.writeFileSync(
    "dist/cjs/package.json",
    JSON.stringify({ type: "commonjs" }, null, 4) + "\n",
);

// Bundle IIFE para usar com `mini-clj -t app.clj --target iife`.
// A entrada é o runtime SEM `fs`, por isso ele empacota para browser.
await esbuild.build({
    entryPoints: ["dist/runtime/index.js"],
    bundle: true,
    format: "iife",
    globalName: "MiniClojureRuntime",
    platform: "browser",
    target: "es2020",
    outfile: "dist/runtime.global.js",
    legalComments: "none",
});

// Bundle completo para browser: interpretador + compilador, sem `fs`.
await esbuild.build({
    entryPoints: ["dist/browser/index.js"],
    bundle: true,
    format: "iife",
    globalName: "MiniClojure",
    platform: "browser",
    target: "es2020",
    outfile: "dist/mini-clojure.global.js",
    legalComments: "none",
});

for (const file of ["dist/runtime.global.js", "dist/mini-clojure.global.js"]) {
    const kb = (fs.statSync(file).size / 1024).toFixed(1);
    console.log(`bundle de browser: ${file} (${kb} kB)`);
}
