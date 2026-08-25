;; =========================================================
;; [R3/E1] Seq/core functions  — issue #12
;; Cada função tem no mínimo 3 asserções.
;; =========================================================
(println "--- INICIO SEQ SUITE ---")

;; --- reduce ---
(assert (= (reduce + [1 2 3]) 6) "reduce sem valor inicial")
(assert (= (reduce + 10 [1 2 3]) 16) "reduce com valor inicial")
(assert (= (reduce (fn [acc x] (+ acc (* x x))) 0 [2 3]) 13) "reduce com fn de usuário")
(assert (= (reduce + []) 0) "reduce em coleção vazia usa a aridade 0")

;; --- filter ---
(assert (= (filter even? [1 2 3 4 5 6]) '(2 4 6)) "filter com predicado nativo")
(assert (= (filter (fn [x] (> x 3)) [1 2 3 4 5]) '(4 5)) "filter com fn de usuário")
(assert (= (count (filter (fn [x] false) [1 2 3])) 0) "filter que rejeita tudo")

;; --- remove ---
(assert (= (remove even? [1 2 3 4]) '(1 3)) "remove é o complemento de filter")
(assert (= (remove (fn [x] true) [1 2]) '()) "remove que descarta tudo")
(assert (= (remove nil? [1 nil 2]) '(1 2)) "remove nils")

;; --- some ---
(assert (= (some (fn [x] (= x 3)) [1 2 3 4]) true) "some encontra o elemento")
(assert (= (some (fn [x] (> x 10)) [1 2 3]) nil) "some retorna nil quando não acha")
(assert (= (some identity [false nil 5 nil]) 5) "some retorna o valor verdadeiro")

;; --- every? ---
(assert (= (every? pos? [1 2 3]) true) "every? verdadeiro")
(assert (= (every? even? [2 4 5]) false) "every? falso")
(assert (= (every? identity []) true) "every? em coleção vazia é true")

;; --- take / drop ---
(assert (= (take 2 [1 2 3 4]) '(1 2)) "take pega o prefixo")
(assert (= (take 10 [1 2]) '(1 2)) "take além do tamanho")
(assert (= (take 0 [1 2]) '()) "take 0 é vazio")
(assert (= (drop 2 [1 2 3 4]) '(3 4)) "drop remove o prefixo")
(assert (= (drop 10 [1 2]) '()) "drop além do tamanho")
(assert (= (drop 0 [1 2]) '(1 2)) "drop 0 mantém tudo")

;; --- range ---
(assert (= (range 5) '(0 1 2 3 4)) "range com um argumento")
(assert (= (range 5 8) '(5 6 7)) "range com início e fim")
(assert (= (range 0 10 2) '(0 2 4 6 8)) "range com passo")
(assert (= (range 3 0 -1) '(3 2 1)) "range com passo negativo")

;; --- repeat ---
(assert (= (repeat 3 :x) '(:x :x :x)) "repeat n vezes")
(assert (= (repeat 0 :x) '()) "repeat 0 é vazio")
(assert (= (count (repeat 5 "a")) 5) "repeat conta correto")

;; --- apply ---
(assert (= (apply + [1 2 3]) 6) "apply com sequência")
(assert (= (apply + 1 [2 3]) 6) "apply com argumentos fixos + sequência")
(assert (= (apply max [1 5 2]) 5) "apply com max")

;; --- comp ---
(def double (fn [x] (* x 2)))
(assert (= ((comp inc double) 3) 7) "comp aplica da direita para a esquerda")
(assert (= ((comp) 42) 42) "comp sem fns é identity")
(assert (= ((comp inc inc inc) 0) 3) "comp encadeia várias fns")

;; --- partial ---
(def add1 (partial + 1))
(assert (= (add1 5) 6) "partial fixa o primeiro argumento")
(assert (= ((partial + 1 2) 3) 6) "partial fixa vários argumentos")
(assert (= ((partial str "a") "b") "ab") "partial com str")

;; --- identity ---
(assert (= (identity 42) 42) "identity de número")
(assert (= (identity nil) nil) "identity de nil")
(assert (= (identity [1 2]) [1 2]) "identity de vetor")

;; --- into ---
(assert (= (into [1] [2 3]) [1 2 3]) "into preserva vetor")
(assert (= (into [] '(1 2)) [1 2]) "into de lista para vetor")
(assert (= (get (into {} [[:a 1]]) :a) 1) "into em mapa aceita pares")

;; --- seq ---
(assert (= (seq []) nil) "seq de vazio é nil")
(assert (= (seq [1 2]) '(1 2)) "seq de vetor")
(assert (= (seq "ab") '("a" "b")) "seq de string")
(assert (= (seq nil) nil) "seq de nil é nil")

;; --- reverse ---
(assert (= (reverse [1 2 3]) '(3 2 1)) "reverse de vetor")
(assert (= (reverse []) '()) "reverse de vazio")
(assert (= (first (reverse [1 2 3])) 3) "reverse coloca o último primeiro")

;; --- last / count / nth / cons / conj / concat ---
(assert (= (last [1 2 3]) 3) "last")
(assert (= (last []) nil) "last de vazio é nil")
(assert (= (count {:a 1 :b 2}) 2) "count de mapa")
(assert (= (count "abc") 3) "count de string")
(assert (= (nth [1 2 3] 1) 2) "nth por índice")
(assert (= (conj [1 2] 3) [1 2 3]) "conj em vetor adiciona no fim")
(assert (= (conj '(1 2) 0) '(0 1 2)) "conj em lista adiciona no início")
(assert (= (conj [1] 2 3) [1 2 3]) "conj variádico")
(assert (= (concat [1] [2] [3]) '(1 2 3)) "concat variádico")

;; --- map (variádico) ---
(assert (= (map inc [1 2 3]) '(2 3 4)) "map com fn nativa")
(assert (= (map (fn [x] (* x x)) [1 2 3]) '(1 4 9)) "map com fn de usuário")
(assert (= (map + [1 2] [10 20]) '(11 22)) "map com duas coleções")

;; --- mapas: contains? / merge / update / get-in / assoc-in / update-in ---
(assert (= (contains? {:a 1} :a) true) "contains? em mapa")
(assert (= (contains? {:a 1} :b) false) "contains? chave ausente")
(assert (= (contains? [1 2] 1) true) "contains? em vetor usa índice")
(assert (= (merge {:a 1} {:b 2}) {:a 1 :b 2}) "merge de dois mapas")
(assert (= (merge {:a 1} {:a 2}) {:a 2}) "merge: o último vence")
(assert (= (merge {:a 1} nil) {:a 1}) "merge ignora nil")
(assert (= (update {:a 1} :a inc) {:a 2}) "update aplica a função")
(assert (= (update {:a 1} :b (fn [v] 9)) {:a 1 :b 9}) "update em chave ausente")
(assert (= (get-in {:a {:b 1}} [:a :b]) 1) "get-in aninhado")
(assert (= (get-in {:a {:b 1}} [:a :z] :nada) :nada) "get-in com valor padrão")
(assert (= (assoc-in {:a {:b 1}} [:a :b] 9) {:a {:b 9}}) "assoc-in aninhado")
(assert (= (update-in {:a {:b 1}} [:a :b] inc) {:a {:b 2}}) "update-in aninhado")
(assert (= (dissoc {:a 1 :b 2} :a) {:b 2}) "dissoc remove a chave")

(println "--- FIM SEQ SUITE ---")
