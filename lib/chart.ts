export function construirEscalaGrafico(valores: number[]): {
  maximo: number;
  ticks: number[];
} {
  const maiorValor = Math.max(0, ...valores);
  const maximo = Math.max(maiorValor, 1);
  const passo = Math.max(1, Math.ceil(maximo / 5));
  const ticks = new Set([0, 1, maximo]);

  for (let valor = passo; valor < maximo; valor += passo) {
    ticks.add(valor);
  }

  return { maximo, ticks: [...ticks].sort((a, b) => a - b) };
}
