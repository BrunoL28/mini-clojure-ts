(print "--- Teste de Interoperabilidade JS ---")

;; 1. Usando Math.max nativo
(print "Máximo entre 10 e 20 (via js/Math):")
(print (. :max js/Math 10 20))

;; 2. Acessando propriedade Math.PI
(print "Valor de PI:")
(print (. :PI js/Math))

;; 3. Instanciando Objeto (Date)
(def data (new js/Date))
(print "Data atual (Objeto Nativo):")
(print data)

(print "Ano atual (chamando .getFullYear):")
(print (. :getFullYear data))

;; 4. Usando console.warn (interessante pois muda a cor no terminal do node)
(. :warn js/console "Atenção: Isto é um aviso direto do JS!")

;; 5. Manipulação de Arrays do JS
(def meu-vetor [1 2 3])
(print "Usando .push nativo do JS no vetor:")
(. :push meu-vetor 4)
(print meu-vetor)

(print "Usando .join nativo:")
(print (. :join meu-vetor " - "))