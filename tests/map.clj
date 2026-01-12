(print "--- Teste da Função MAP ---")

(def numeros '(1 2 3 4))

(print "Lista original:")
(print numeros)

(print "Multiplicando tudo por 10:")
(def resultado (map (fn [x] (* x 10)) numeros))

(print resultado)

(print "Usando função definida:")
(def quadrado (fn [n] (* n n)))
(print (map quadrado numeros))

(print "--- Fim ---")