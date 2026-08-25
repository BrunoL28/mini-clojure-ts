# Desempenho, limites e observabilidade

Cobre os benchmarks ([#28]), o tracing e o profiler ([#29]) e os limites de
execução e impressão ([#30]).

---

## Benchmarks ([#28])

```sh
pnpm bench                        # mede e imprime
pnpm bench --save antes.json      # grava os números
pnpm bench --baseline antes.json  # compara com uma medição anterior
```

Cada caso é **calibrado** para durar ~50 ms por amostra e o resultado reportado
é o **melhor de 9 amostras** — numa máquina compartilhada o ruído só atrasa, e
a amostra mais rápida é a menos contaminada.

Os números são específicos da máquina; o que vale é a comparação local.

### ⚠️ Como _não_ comparar duas versões

Carregar duas árvores do interpretador **no mesmo processo** e alternar as
medições parece a forma óbvia. Não é: a segunda cópia sai **~30% mais lenta
mesmo sendo byte a byte idêntica**, porque as duas cópias compartilham os
mesmos call sites no V8 e a segunda os encontra já polimórficos.

Isso foi verificado com um experimento de controle — comparar a versão antiga
com uma cópia dela mesma acusou "-30% de regressão". Compare **processos
separados**, alternando a ordem entre rodadas.

### Ganhos do R7 sobre o R6

| Caso                           | Ganho     |
| ------------------------------ | --------- |
| `into` de 1k elementos         | **+477×** |
| `map` + `filter` + `reduce`    | +23%      |
| destructuring de vetor com `&` | +18%      |
| `assoc`/`get` encadeados       | +11%      |
| chamada de função de usuário   | +9%       |
| lookup em escopo profundo      | +8%       |
| recursão de cauda              | +8%       |

O que mudou:

- **`into` e `conj` deixaram de ser quadráticos.** Cada item recriava o vetor
  inteiro: `(into [] (range 32000))` levava 39 s, hoje leva 0,5 s. Acima de
  ~130k elementos o espalhamento de argumentos ainda estourava o limite do
  JavaScript e o processo travava.
- **`Env` usa objeto sem protótipo.** Era `{}`, e `"constructor" in vars` é
  verdadeiro pelo protótipo — símbolos indefinidos como `constructor` ou
  `toString` resolviam para membros de `Object.prototype` em vez de dar erro.
  `Map` corrige mas custa ~25%; `Object.create(null)` corrige de graça.
- **Despacho de formas especiais por `Set`.** Toda chamada de função percorria
  ~25 comparações de string antes de chegar ao caminho de aplicação.
- **Laços O(n) removidos do destructuring.** As buscas por chave varriam o mapa
  quando a chave faltava; o HAMT já indexa keywords e símbolos por valor.

---

## Limites ([#30])

### Tempo de execução

```sh
mini-clj --timeout 5000 app.clj
```

```
Execução interrompida: passou do limite de 5000 ms. Isso costuma ser recursão
sem caso base ou laço que não termina. Ajuste com --timeout, ou 0 para desligar.
```

Sem `--timeout` não há limite. A verificação acontece a cada 2048 formas
avaliadas — consultar o relógio a cada forma custaria caro, e o erro de
detecção é de milissegundos.

```typescript
runSource(codigo, { timeoutMs: 5000 });
```

### Impressão

```sh
mini-clj --print-length 20 app.clj
```

```clojure
(set-print-length! 10)   ; itens por coleção; nil = sem limite
(set-print-level! 3)     ; profundidade de aninhamento
(print-limits)           ;=> {:length 10 :level 3}
```

```clojure
(set-print-length! 3)
(pr-str (range 100))     ;=> "(0 1 2 ...)"

(set-print-level! 2)
(pr-str {:a {:b {:c 1}}}) ;=> "{:a {:b #}}"
```

Como em Clojure, `*print-level*` corta a **coleção** inteira, não os escalares
dentro dela.

> **Sem limite por padrão**, de propósito: truncar quebraria o roundtrip de
> `pr-str` com `read-string`. O **REPL** é a exceção — ele usa 100 por padrão,
> por ser contexto de exibição, e um `--print-length` explícito prevalece.

Com o limite ligado, o formatador **para de formatar** ao atingi-lo: imprimir
`(range 500000)` é instantâneo em vez de montar meio milhão de strings.

### O que os limites **não** cobrem

Não há limite de memória. Um programa que aloca sem parar continua capaz de
derrubar o processo — o `--timeout` só interrompe quem está avaliando formas.

---

## Observabilidade ([#29])

Tudo sai em **stderr**, para não se misturar à saída do programa.

```sh
mini-clj --trace-eval app.clj
mini-clj --trace-eval --trace-depth 3 app.clj
mini-clj --trace-macroexpand app.clj
mini-clj --profile app.clj
```

### Trace de avaliação

```
▸ (+ 1 (* 2 3))
│ ▸ (* 2 3)
```

`--trace-depth` corta o recuo a partir de um nível — sem isso, um programa de
verdade produz uma parede de texto.

### Trace de macroexpansão

```
⤷ macro (dobro 21)
  → (* 2 21)
```

### Profiler

```
— perfil —
formas avaliadas: 37.625
tempo total:      33.69 ms
formas por segundo: 1.116.674

mais avaliadas:
  fib                       8.361   22.2%
  if                        8.361   22.2%
  <                         8.361   22.2%
```

O profiler conta o que o **avaliador** fez. Funções de stdlib iteram em
JavaScript, então `(reduce + (range 1000))` conta 3 formas, não 1000 — o que é
exato, ainda que surpreenda à primeira vista.

### Custo quando desligado

Os ganchos custam ~2-4% mesmo desligados: são uma comparação com `null` por
forma e um bloco `finally` no avaliador. Medido, o R7 continua mais rápido que
o R6 em todos os casos mesmo pagando isso.

[#28]: https://github.com/BrunoL28/mini-clojure-ts/issues/28
[#29]: https://github.com/BrunoL28/mini-clojure-ts/issues/29
[#30]: https://github.com/BrunoL28/mini-clojure-ts/issues/30
