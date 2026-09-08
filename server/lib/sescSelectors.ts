/**
 * Objeto centralizado para mapeamento de seletores HTML do portal SESC SP.
 * Em caso de mudança na estrutura da tabela pelo portal, basta atualizar estes índices.
 */
export const SESC_SELECTORS = {
  // Seletor da linha da tabela contendo os dados
  row: 'tbody tr',
  
  // Índices (base 0) das colunas <td> onde cada dado está localizado
  columns: {
    processNumber: 1,
    agency: 2,
    objectDesc: 3,
    modalidade: 4,
    dateStr: 5
  }
};
