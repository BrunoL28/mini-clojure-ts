# Interop e Sandbox — Mini-Clojure-TS

Contrato de interoperabilidade com JavaScript ([#26]) e o modo sandbox para
rodar código não confiável ([#25]).

---

## `js/...` — acesso a globais

```clojure
js/Math            ;=> o objeto Math
js/Math.PI         ;=> 3.141592653589793
js/JSON.stringify  ;=> a função
```

- O **primeiro segmento** é resolvido pela política de interop em vigor
  (`globalThis` por padrão; a whitelist em sandbox).
- Os segmentos seguintes são acessos de propriedade comuns, cada um passando
  pela verificação de membro da política.
- Segmento ausente **lança erro**, em vez de devolver `nil`:

```clojure
js/NaoExiste       ;=> erro: Global JavaScript 'js/NaoExiste' não encontrado.
js/Math.naoExiste  ;=> erro: Propriedade 'js/Math.naoExiste' não encontrada.
```

> **No compilado**, `js/Math.PI` vira `Math.PI` — resolvido pelo escopo do
> JavaScript. Se o global não existir, o erro é um `ReferenceError` do próprio
> Node em vez da mensagem do interpretador.

---

## `.` — propriedade **ou** método

```clojure
(. membro alvo & args)
```

A regra é uma só: **se o valor for função, é chamado; senão, é devolvido.**

```clojure
(. "PI" js/Math)          ;=> 3.14159...   (propriedade)
(. "toUpperCase" "abc")   ;=> "ABC"        (método, sem args)
(. "repeat" "ab" 3)       ;=> "ababab"     (método, com args)
(. :toUpperCase "abc")    ;=> "ABC"        (membro como keyword)
```

O membro pode ser **string** (`"log"`) ou **keyword** (`:log`) — a keyword tem
os dois-pontos removidos.

**Casos de borda:**

| Situação               | Resultado                                          |
| ---------------------- | -------------------------------------------------- |
| Alvo `nil`/`undefined` | Erro: `Alvo do operador '.' é nulo ou indefinido.` |
| Propriedade ausente    | `nil`                                              |
| Propriedade é função   | **É chamada** — veja `.-` abaixo                   |

O `this` do método é o próprio alvo, então `(. "log" js/console "oi")`
funciona como `console.log("oi")`.

---

## `.-` — propriedade **sem chamar**

```clojure
(.- membro alvo)
```

Existe porque a regra do `.` torna impossível pegar um método como valor:

```clojure
(. "toUpperCase" "abc")        ;=> "ABC"          (chamou)
(.- "toUpperCase" "abc")       ;=> #<Function>    (não chamou)

(.- "constructor" "")          ;=> String
(. "constructor" "")           ;=> ""   (chamou String()!)
```

Use `.-` sempre que quiser o valor bruto da propriedade.

---

## `new` — instanciação

```clojure
(new js/Date 2020 0 1)
(new js/Map)
```

Os argumentos são avaliados e repassados na ordem. O primeiro argumento
precisa ser uma função construtora:

```clojure
(new 42)  ;=> erro: O primeiro argumento de 'new' deve ser uma classe/função construtora.
```

---

## Sandbox ([#25])

```sh
mini-clj --sandbox app.clj
mini-clj --sandbox --allow Intl,URL app.clj
```

```typescript
createGlobalEnv({ sandbox: true, sandboxOptions: { extraAllow: ["Intl"] } });
runSource(codigo, { sandbox: true });
```

### O que muda

| Recurso                   | Aberto | Sandbox        |
| ------------------------- | ------ | -------------- |
| `js/...`                  | tudo   | só a whitelist |
| `slurp` / `spit`          | ✅     | ❌ bloqueado   |
| `require` / `load-file`   | ✅     | ❌ bloqueado   |
| Membros perigosos via `.` | ✅     | ❌ bloqueado   |
| `new js/Function`         | ✅     | ❌ bloqueado   |

### Whitelist padrão

`Math`, `Date`, `JSON`, `String`, `Number`, `Boolean`, `Array`, `Object`,
`RegExp`, `Map`, `Set`, `Error`, `console`, `parseInt`, `parseFloat`, `isNaN`,
`isFinite`.

São globais puros: nenhum deles dá acesso a IO, rede, processo ou avaliação
dinâmica de código. Qualquer outro nome é recusado, mesmo sendo inofensivo —
o default é fechado. Use `--allow` para liberar o que faltar.

### Membros bloqueados

`constructor`, `prototype`, `__proto__`, `__defineGetter__`,
`__defineSetter__`, `__lookupGetter__`, `__lookupSetter__`.

O importante é o `constructor`. Sem ele, bloquear os globais não bloquearia
nada:

```clojure
;; a partir de QUALQUER objeto se chega em Function, e daí em eval:
(.- "constructor" (.- "constructor" ""))   ;=> Function
```

### Onde a política mora

Fora do ambiente, numa `WeakMap` indexada pelo `Env` raiz. Guardá-la **dentro**
do ambiente deixaria o código avaliado desligar o próprio sandbox com um `def`.

---

## ⚠️ Limite honesto: o sandbox não é uma fronteira de segurança

O sandbox roda **no mesmo realm do JavaScript** que o host. Ele eleva bastante
o custo de um escape e cobre as rotas conhecidas, mas **não é uma garantia**
contra código adversário determinado. Trate-o como defesa em profundidade.

Para isolamento de verdade, use uma fronteira que o JavaScript não consiga
atravessar:

- `node:vm` com um contexto separado
- um `Worker` com recursos limitados
- um processo separado, com limites de CPU e memória do sistema operacional

Além disso, o sandbox **não protege contra laços infinitos nem contra
consumo de memória** — não há limite de tempo nem de alocação. Isso é assunto
da issue [#30].

### O código compilado não é sandboxado

O sandbox é um recurso do **interpretador**. No compilado, `js/process` vira
o identificador `process`, resolvido pelo JavaScript sem passar por política
nenhuma. Se você precisa executar código não confiável, **interprete**.

[#25]: https://github.com/BrunoL28/mini-clojure-ts/issues/25
[#26]: https://github.com/BrunoL28/mini-clojure-ts/issues/26
[#30]: https://github.com/BrunoL28/mini-clojure-ts/issues/30
