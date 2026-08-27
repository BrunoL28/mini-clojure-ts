;; =========================================================
;; Verificação executável de docs/semantics.md — issue #1
;;
;; Cada afirmação da especificação vira uma asserção aqui. Se a linguagem
;; mudar sem o documento mudar junto, este arquivo quebra o CI.
;; =========================================================
(println "--- INICIO SEMANTICS SUITE ---")

(defn v [rotulo esperado obtido]
  (assert (= esperado obtido)
          (str rotulo ": esperava " (pr-str esperado) ", obteve " (pr-str obtido))))

;; truthiness
(v "if 0"        :sim (if 0 :sim :nao))
(v "if \"\""     :sim (if "" :sim :nao))
(v "if []"       :sim (if [] :sim :nao))
(v "if {}"       :sim (if {} :sim :nao))
(v "if nil"      :nao (if nil :sim :nao))

;; igualdade
(v "= estrutural" true (= [1 {:a 1}] [1 {:a 1}]))
(v "= encadeado"  true (= 1 1 1))
(v "identical?"   false (identical? [1] [1]))
(v "vetor = lista" true (= [1 2] (list 1 2)))

;; tipos
(v "list? vetor"  false (list? [1]))
(v "vector? vetor" true (vector? [1]))
(v "seq? filter"  true (seq? (filter odd? [1])))
(v "/ 1 3"        0.3333333333333333 (/ 1 3))

;; formas
(v "if sem senão" nil (if false :a))
(v "and vazio"    true (and))
(v "or vazio"     nil (or))
(v "and 1 2 3"    3 (and 1 2 3))
(v "or nil f 7"   7 (or nil false 7))
(v "cond :else"   :pad (cond false :a :else :pad))
(v "when-not"     :ok (when-not false :ok))
(v "-> primeiro"  2 (-> {:a 1} (assoc :b 2) (get :b)))
(v "->> último"   1140 (->> (range 20) (filter even?) (map (fn [x] (* x x))) (reduce + 0)))

;; def dentro de fn não escapa
(defn interna [] (def local-da-fn 1) :feito)
(interna)
(v "def em fn não escapa" :nao-vazou (try local-da-fn (catch e :nao-vazou)))

;; forma especial vence binding
(def if 1)
(v "forma especial vence" :sim (if true :sim :nao))

;; TCO
(defn soma-ate [n acc] (if (<= n 0) acc (soma-ate (- n 1) (+ acc n))))
(v "TCO 100k" 5000050000 (soma-ate 100000 0))

;; destructuring
(v "seq destruct"   3 (let [[a b] [1 2]] (+ a b)))
(v "rest"           [2 3] (let [[a & r] [1 2 3]] r))
(v "aninhado"       1 (let [[[a b] c] [[1 2] 3]] a))
(v "nil punning"    nil (let [[a b] [1]] b))
(v ":keys"          3 (let [{:keys [a b]} {:a 1 :b 2}] (+ a b)))
(v "renomeação"     7 (let [{v2 :chave} {:chave 7}] v2))
(v ":or"            9 (let [{:keys [a] :or {a 9}} {}] a))
(v ":as"            {:a 1} (let [{:keys [a] :as t} {:a 1}] t))
(v "destruct nil"   nil (let [{:keys [a]} nil] a))

;; macros
(defmacro a-menos-que [teste & corpo] `(if ~teste nil (do ~@corpo)))
(v "macro variádica" :fim (a-menos-que false :meio :fim))
(v "~@ vazio"        (list :a :b) `(:a ~@[] :b))

;; erros
(v "catch é mensagem" "boom" (try (throw "boom") (catch e e)))

;; persistência
(def base {:nome "ana" :tags [:a :b]})
(def novo (assoc-in base [:endereco :cidade] "sp"))
(v "original intacto" {:nome "ana" :tags [:a :b]} base)
(v "novo tem cidade"  "sp" (get-in novo [:endereco :cidade]))

;; keyword como função
(v "kw fn"        1 (:a {:a 1}))
(v "kw ausente"   nil (:z {:a 1}))

;; interop
(v "método"       "ABC" (. "toUpperCase" "abc"))
(v "js pontuado"  3.141592653589793 js/Math.PI)

;; saudar
(defn saudar [{:keys [nome] :or {nome "mundo"}}] (str "olá, " nome))
(v "saudar {}" "olá, mundo" (saudar {}))

;; atom
(def contador (atom 0))
(swap! contador + 5)
(v "atom" 5 @contador)

;; sequências preguiçosas
(v "(range) é infinita e preguiçosa" (list 0 1 2) (take 3 (range)))
(v "map preguiçoso sobre infinita" (list 0 1 4) (take 3 (map (fn [x] (* x x)) (range))))
(v "filter preguiçoso" (list 0 2 4) (take 3 (filter even? (range))))
(v "take-while para no primeiro falso" (list 1 3 9) (take-while (fn [x] (< x 20)) (iterate (fn [x] (* x 3)) 1)))
(v "seq? de sequência preguiçosa" true (seq? (map inc [1 2])))
(v "= realiza a preguiçosa" true (= (list 1 2 3) (map inc [0 1 2])))

(println "--- FIM SEMANTICS SUITE ---")
