(print "--- Iniciando o Programa Compilado ---")

(def a 10)
(def b 20)

(print "Somando a + b...")
(def resultado (+ a b))

(print "Resultado da soma:" resultado)

(def verificar (fn [x]
  (if (> x 15)
      "É maior que 15"
      "É pequeno")))

(print "Verificação:" (verificar resultado))

;; Teste de Interop
(. log js/console "Isto é um console.log nativo do JS!")