(print "--- Manipulação de Listas ---")

(def numeros (quote (10 20 30 40 50)))

(print "A lista completa:")
(print numeros)

(print "O primeiro elemento (first):")
(print (first numeros))

(print "O resto da lista (rest):")
(print (rest numeros))

(print "Contagem de elementos:")
(print (count numeros))

(print "Usando o atalho de apóstrofo ' :")
(def frutas '(maca banana laranja))
(print (first (rest frutas))) ; Deve imprimir banana