;; Módulo que requer outro módulo — prova resolução relativa ao próprio arquivo
;; e require transitivo.
(require "./math.clj" :as m)

(defn triplo-soma [a b] (* 3 (m/soma a b)))
(def pi-dobrado (* 2 m/pi))
