"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Sincronizacao = {
  versao: number;
  notificar: () => void;
};

const Contexto = createContext<Sincronizacao | null>(null);

/**
 * Avisa o gráfico (e outros componentes) que algo mudou no banco.
 * O grid não precisa conhecer o gráfico e vice-versa.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const [versao, setVersao] = useState(0);

  const notificar = useCallback(() => {
    setVersao((atual) => atual + 1);
  }, []);

  const valor = useMemo(() => ({ versao, notificar }), [versao, notificar]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSync(): Sincronizacao {
  const contexto = useContext(Contexto);
  if (!contexto) {
    throw new Error("useSync precisa estar dentro de SyncProvider.");
  }
  return contexto;
}
