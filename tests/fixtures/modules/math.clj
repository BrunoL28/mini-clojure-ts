;; Módulo de exemplo: expõe soma, pi e uma constante derivada.
(def carregou (atom 0))
(swap! carregou inc)

(def pi 3.14)
(defn soma [a b] (+ a b))
(defn dobro [x] (* x 2))

;; `privada` só é "privada" por convenção: tudo que o módulo define é público.
(defn interna [x] (+ x 100))
