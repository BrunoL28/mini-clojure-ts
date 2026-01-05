(println ">>> Testes Épico 4: Map Destructuring")

(defn assert [val expected msg]
  (if (= val expected)
    (println "PASS:" msg)
    (do
      (println "FAIL:" msg)
      (println "  Esperado:" expected)
      (println "  Recebido:" val)
      (throw "Teste falhou"))))

;; 1. :keys básico
(let [{:keys [a b]} {:a 10 :b 20}]
  (assert a 10 ":keys a")
  (assert b 20 ":keys b"))

;; 2. :keys com valores faltando (nil implicit)
(let [{:keys [x y]} {:x 1}]
  (assert x 1 ":keys x presente")
  (assert y nil ":keys y faltando é nil"))

;; 3. :as (mapa original)
(let [{:keys [a] :as m} {:a 99 :b 88}]
  (assert a 99 ":as extração")
  (assert (:b m) 88 ":as acesso ao original"))

;; 4. :or (valores padrão)
(let [{:keys [a b] :or {b 100}} {:a 1}]
  (assert a 1 ":or a existe")
  (assert b 100 ":or b usa default"))

;; 5. :or com expressões (devem ser avaliadas)
(let [{:keys [z] :or {z (+ 10 20)}} {}]
  (assert z 30 ":or avalia expressão"))

;; 6. Renomeação manual {var :key}
(let [{val :valor} {:valor 42}]
  (assert val 42 "Renomeação simples {val :key}"))

;; 7. Nil Punning (destructuring em nil)
(let [{:keys [a] :or {a 5}} nil]
  (assert a 5 "Nil punning usa default"))

;; 8. Argumentos de Função
(defn test-fn [{:keys [msg] :or {msg "oi"}}]
  msg)

(assert (test-fn {:msg "ola"}) "ola" "Fn arg passado")
(assert (test-fn {}) "oi" "Fn arg default")
(assert (test-fn nil) "oi" "Fn arg nil punning")

(println ">>> Sucesso! Destructuring validado.")