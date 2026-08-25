;; Módulo com efeito colateral observável, para provar o cache.
(def execucoes (atom 0))
(swap! execucoes inc)
(def marca "carregado")
