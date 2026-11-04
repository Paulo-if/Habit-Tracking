/**
 * Porcentagem de conclusão de um dia.
 * Todos os itens têm o mesmo peso.
 *
 * Regra importante: dia sem itens previstos tem valor NULO (não é 0%).
 * Assim conseguimos mostrar uma lacuna no gráfico em vez de uma queda falsa.
 */
export function calcularPercentual(
  concluidos: number,
  previstos: number,
): number | null {
  if (!Number.isFinite(previstos) || previstos <= 0) return null;
  const seguros = Math.min(Math.max(concluidos, 0), previstos);
  return Math.round((seguros / previstos) * 100);
}
