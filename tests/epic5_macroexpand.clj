(println ">>> Testes Épico 5: Macroexpand")

(defn assert [val expected msg]
  (if (= val expected)
    (println "PASS:" msg)
    (do
      (println "FAIL:" msg)
      (println "  Esperado:" expected)
      (println "  Recebido:" val)
      (throw "Teste falhou"))))

;; 1. Definir uma macro simples
(defmacro unless [pred a b]
  `(if (not ~pred) ~a ~b))

;; 2. Testar macroexpand-1 (apenas 1 nível)
(def form1 '(unless true :a :b))
(def expanded1 (macroexpand-1 form1))

;; O resultado esperado é a lista (if (not true) :a :b)
(assert (first expanded1) 'if "Primeiro elemento é if")
(assert (second expanded1) '(not true) "Condição expandida")
(assert (nth expanded1 2) :a "Branch then")
(assert (nth expanded1 3) :b "Branch else")
(println "PASS: macroexpand-1 funcionou para unless")

;; 3. Testar macroexpand (aninhado)
(defmacro nested [] 
  '(unless false 1 2))

(def form2 '(nested))
;; macroexpand-1 expandiria para (unless false 1 2)
;; macroexpand deve expandir para (if (not false) 1 2)

(def full-expanded (macroexpand form2))

(assert (first full-expanded) 'if "Full expansion resultou em if")
(println "PASS: macroexpand recursivo funcionou")

;; 4. Testar expansão de algo que não é macro (deve retornar o original)
(def func-call '(+ 1 2))
(assert (macroexpand func-call) func-call "Não expande chamada de função")

(println ">>> Sucesso! Ferramentas de macro validadas.")