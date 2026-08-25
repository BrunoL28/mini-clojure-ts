;; =========================================================
;; [R4/E1] Loader e cache + [R4/E2] Namespaces — issues #16, #17
;; Política: env por módulo + alias. Sem `ns`.
;; =========================================================
(println "--- INICIO MODULES SUITE ---")

;; --- require com :as ---
(require "./modules/math.clj" :as math)
(assert (= (math/soma 1 2) 3) "alias resolve função do módulo")
(assert (= math/pi 3.14) "alias resolve valor do módulo")
(assert (= (math/dobro 4) 8) "alias resolve segunda função")

;; --- isolamento: o módulo não vaza para quem requer ---
(require "./modules/privado.clj" :as p)
(assert (= (p/funcao-do-modulo) :ok) "alias enxerga o que o módulo define")
(assert (= (try segredo-do-modulo :vazou (catch e :nao-vazou)) :nao-vazou)
        "def do módulo NÃO vaza para o env de quem requer com :as")

;; --- isolamento: o alias não expõe a stdlib herdada ---
(assert (= (try (math/reduce + [1 2]) :expos (catch e :isolado)) :isolado)
        "alias não expõe símbolos herdados da stdlib")

;; --- membro inexistente dá erro claro ---
(assert (= (try math/nao-existe :sem-erro (catch e :erro)) :erro)
        "membro inexistente no módulo lança erro")

;; --- require sem :as traz os nomes para o env atual ---
(require "./modules/math.clj")
(assert (= (soma 10 20) 30) "require sem :as refere as funções")
(assert (= pi 3.14) "require sem :as refere os valores")

;; --- cache: o módulo executa uma única vez ---
(require "./modules/contador.clj" :as c1)
(require "./modules/contador.clj" :as c2)
(assert (= @c1/execucoes 1) "require executa o módulo uma única vez")
(assert (= @c2/execucoes 1) "segundo require vem do cache, não reexecuta")
(assert (= c1/marca "carregado") "módulo em cache mantém os valores")

;; --- require transitivo, resolvido a partir do arquivo do módulo ---
(require "./modules/usa-math.clj" :as u)
(assert (= (u/triplo-soma 2 3) 15) "módulo que requer outro módulo funciona")
(assert (= u/pi-dobrado 6.28) "require transitivo resolve relativo ao módulo")

;; --- extensão .clj é opcional ---
(require "./modules/math" :as math-sem-ext)
(assert (= (math-sem-ext/soma 4 4) 8) "extensão .clj é opcional no require")

;; --- módulo inexistente ---
(assert (= (try (require "./modules/nao-existe.clj") :sem-erro (catch e :erro)) :erro)
        "require de módulo inexistente lança erro")

;; --- load-file: env atual, sempre reexecuta ---
(def carregamentos (atom 0))
(load-file "./modules/efeito.clj")
(assert (= @carregamentos 1) "load-file executa no env de quem chamou")
(assert (= veio-do-load-file :sim) "load-file define no env atual")
(load-file "./modules/efeito.clj")
(assert (= @carregamentos 2) "load-file sempre reexecuta (sem cache)")

;; --- a divisão continua sendo a divisão ---
(assert (= (/ 10 2) 5) "o símbolo / não é confundido com alias/membro")
(assert (= (/ 100 5 2) 10) "divisão variádica intacta")

(println "--- FIM MODULES SUITE ---")
