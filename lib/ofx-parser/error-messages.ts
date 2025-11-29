/**
 * Comprehensive error messages and user guidance for OFX import
 * 
 * This module centralizes all error messages, warnings, and user guidance
 * for the OFX import workflow to ensure consistent, helpful messaging.
 */

export type ErrorCode = 
  // File validation errors
  | "FILE_TOO_LARGE"
  | "FILE_INVALID_TYPE"
  | "FILE_EMPTY"
  | "FILE_CORRUPTED"
  
  // Parsing errors
  | "PARSE_FAILED"
  | "PARSE_INVALID_FORMAT"
  | "PARSE_NO_TRANSACTIONS"
  | "PARSE_INCOMPLETE_DATA"
  
  // Network errors
  | "NETWORK_TIMEOUT"
  | "NETWORK_UNAVAILABLE"
  | "NETWORK_SERVER_ERROR"
  
  // AI categorization errors
  | "AI_TIMEOUT"
  | "AI_FAILED"
  | "AI_NO_SUGGESTIONS"
  | "AI_RATE_LIMIT"
  
  // Duplicate handling errors
  | "DUPLICATE_DETECTION_FAILED"
  | "DUPLICATE_CONFLICT"
  
  // Database errors
  | "DB_CONNECTION_FAILED"
  | "DB_TRANSACTION_FAILED"
  | "DB_CONSTRAINT_VIOLATION"
  
  // Permission errors
  | "PERMISSION_DENIED"
  | "ACCOUNT_NOT_FOUND"
  | "UNAUTHORIZED"
  
  // Validation errors
  | "VALIDATION_FAILED"
  | "TRANSACTION_LIMIT_EXCEEDED"
  | "MISSING_REQUIRED_FIELDS"
  | "INVALID_DATE_FORMAT"
  | "INVALID_AMOUNT";

export interface ErrorMessage {
  title: string;
  description: string;
  guidance: string[];
  severity: "error" | "warning" | "info";
  recoverable: boolean;
}

export const ERROR_MESSAGES: Record<ErrorCode, ErrorMessage> = {
  // File validation errors
  FILE_TOO_LARGE: {
    title: "Arquivo muito grande",
    description: "O arquivo OFX excede o limite de 10 MB.",
    guidance: [
      "Reduza o período de transações exportadas do seu banco",
      "Divida o arquivo em múltiplas importações menores",
      "Verifique se o arquivo não contém dados duplicados ou desnecessários"
    ],
    severity: "error",
    recoverable: true,
  },
  
  FILE_INVALID_TYPE: {
    title: "Tipo de arquivo inválido",
    description: "Apenas arquivos com extensão .ofx são aceitos.",
    guidance: [
      "Certifique-se de exportar no formato OFX (não CSV ou PDF)",
      "Verifique se a extensão do arquivo é .ofx",
      "Alguns bancos chamam o formato de 'Money' ou 'Quicken'"
    ],
    severity: "error",
    recoverable: true,
  },
  
  FILE_EMPTY: {
    title: "Arquivo vazio",
    description: "O arquivo OFX não contém dados.",
    guidance: [
      "Verifique se o arquivo foi exportado corretamente do seu banco",
      "Confirme que há transações no período selecionado",
      "Tente fazer o download novamente do site do banco"
    ],
    severity: "error",
    recoverable: true,
  },
  
  FILE_CORRUPTED: {
    title: "Arquivo corrompido",
    description: "O arquivo OFX está corrompido ou incompleto.",
    guidance: [
      "Faça o download do arquivo novamente do site do banco",
      "Verifique se o download foi concluído completamente",
      "Não edite o arquivo OFX manualmente",
      "Se o problema persistir, contate o suporte do seu banco"
    ],
    severity: "error",
    recoverable: true,
  },
  
  // Parsing errors
  PARSE_FAILED: {
    title: "Erro ao processar arquivo",
    description: "Não foi possível processar o arquivo OFX.",
    guidance: [
      "Verifique se o arquivo está no formato OFX padrão",
      "Alguns bancos usam formatos proprietários - confirme o formato correto",
      "Tente exportar o arquivo novamente com configurações diferentes",
      "Entre em contato com o suporte para formatos específicos do seu banco"
    ],
    severity: "error",
    recoverable: true,
  },
  
  PARSE_INVALID_FORMAT: {
    title: "Formato OFX inválido",
    description: "O arquivo não está no formato OFX esperado.",
    guidance: [
      "Certifique-se de selecionar 'OFX' ou 'Money/Quicken' na exportação do banco",
      "Não confunda com CSV, Excel ou PDF",
      "Verifique se o arquivo começa com tags XML ou SGML típicas de OFX",
      "Consulte o manual do seu banco sobre exportação OFX"
    ],
    severity: "error",
    recoverable: true,
  },
  
  PARSE_NO_TRANSACTIONS: {
    title: "Nenhuma transação encontrada",
    description: "O arquivo OFX não contém transações válidas.",
    guidance: [
      "Verifique se há transações no período selecionado na exportação",
      "Confirme que a conta tem movimentações no período",
      "Tente selecionar um período maior na exportação do banco",
      "Verifique se o tipo de conta está correto (corrente, poupança, cartão)"
    ],
    severity: "error",
    recoverable: true,
  },
  
  PARSE_INCOMPLETE_DATA: {
    title: "Dados incompletos detectados",
    description: "Algumas transações têm informações faltando.",
    guidance: [
      "Transações com dados críticos faltando serão ignoradas automaticamente",
      "Descrições vazias serão substituídas por 'Sem descrição'",
      "Revise as transações importadas na próxima etapa",
      "Você pode completar as informações manualmente após a importação"
    ],
    severity: "warning",
    recoverable: true,
  },
  
  // Network errors
  NETWORK_TIMEOUT: {
    title: "Tempo esgotado",
    description: "A requisição demorou muito tempo para responder.",
    guidance: [
      "Verifique sua conexão com a internet",
      "Tente novamente em alguns instantes",
      "Se o problema persistir, o servidor pode estar sobrecarregado",
      "Considere importar arquivos menores com menos transações"
    ],
    severity: "error",
    recoverable: true,
  },
  
  NETWORK_UNAVAILABLE: {
    title: "Sem conexão",
    description: "Não foi possível conectar ao servidor.",
    guidance: [
      "Verifique sua conexão com a internet",
      "Confirme se o servidor está acessível",
      "Tente novamente em alguns minutos",
      "Verifique se não há firewall ou proxy bloqueando a conexão"
    ],
    severity: "error",
    recoverable: true,
  },
  
  NETWORK_SERVER_ERROR: {
    title: "Erro no servidor",
    description: "O servidor encontrou um erro ao processar sua requisição.",
    guidance: [
      "Tente novamente em alguns instantes",
      "O erro foi registrado e será investigado",
      "Se o problema persistir, entre em contato com o suporte",
      "Seus dados estão seguros - nenhuma alteração foi feita"
    ],
    severity: "error",
    recoverable: true,
  },
  
  // AI categorization errors
  AI_TIMEOUT: {
    title: "Tempo de categorização esgotado",
    description: "A categorização automática levou muito tempo.",
    guidance: [
      "Algumas transações não foram categorizadas automaticamente",
      "Você pode categorizar manualmente na próxima etapa",
      "A categorização manual é tão eficaz quanto a automática",
      "Tente novamente com um arquivo menor se preferir usar a IA"
    ],
    severity: "warning",
    recoverable: true,
  },
  
  AI_FAILED: {
    title: "Categorização automática falhou",
    description: "Não foi possível categorizar automaticamente as transações.",
    guidance: [
      "Use a categorização manual para cada transação",
      "O sistema aprenderá com suas escolhas para futuras importações",
      "Verifique se as configurações de IA estão corretas",
      "A categorização manual garante precisão total"
    ],
    severity: "warning",
    recoverable: true,
  },
  
  AI_NO_SUGGESTIONS: {
    title: "Sem sugestões de categoria",
    description: "A IA não encontrou categorias compatíveis.",
    guidance: [
      "Selecione a categoria manualmente para cada transação",
      "Considere criar categorias mais específicas para suas transações",
      "O sistema melhorará as sugestões com mais dados históricos",
      "Descrições mais detalhadas ajudam a IA a sugerir melhor"
    ],
    severity: "info",
    recoverable: true,
  },
  
  AI_RATE_LIMIT: {
    title: "Limite de requisições atingido",
    description: "Muitas requisições de categorização foram feitas.",
    guidance: [
      "Aguarde alguns minutos antes de tentar novamente",
      "Use categorização manual para continuar imediatamente",
      "Considere importar em lotes menores",
      "O limite de requisições será resetado em breve"
    ],
    severity: "warning",
    recoverable: true,
  },
  
  // Duplicate handling errors
  DUPLICATE_DETECTION_FAILED: {
    title: "Detecção de duplicatas falhou",
    description: "Não foi possível verificar duplicatas.",
    guidance: [
      "As transações serão importadas sem verificação de duplicatas",
      "Revise manualmente se há transações repetidas",
      "Você pode deletar duplicatas após a importação",
      "Este erro não impede a importação de continuar"
    ],
    severity: "warning",
    recoverable: true,
  },
  
  DUPLICATE_CONFLICT: {
    title: "Duplicatas detectadas",
    description: "Algumas transações podem já existir no sistema.",
    guidance: [
      "Revise cada transação marcada como duplicata",
      "Escolha 'Pular' para não importar a transação",
      "Escolha 'Importar' se for uma transação diferente",
      "Escolha 'Atualizar' para substituir a transação existente"
    ],
    severity: "warning",
    recoverable: true,
  },
  
  // Database errors
  DB_CONNECTION_FAILED: {
    title: "Erro de conexão com banco de dados",
    description: "Não foi possível conectar ao banco de dados.",
    guidance: [
      "Tente novamente em alguns instantes",
      "O problema pode ser temporário",
      "Verifique se o serviço está disponível",
      "Entre em contato com o suporte se o erro persistir"
    ],
    severity: "error",
    recoverable: true,
  },
  
  DB_TRANSACTION_FAILED: {
    title: "Falha ao salvar transações",
    description: "Ocorreu um erro ao salvar as transações no banco de dados.",
    guidance: [
      "Nenhuma transação foi importada - seus dados estão seguros",
      "Tente novamente com o mesmo arquivo",
      "Verifique se há espaço suficiente no banco de dados",
      "Entre em contato com o suporte se o problema persistir"
    ],
    severity: "error",
    recoverable: true,
  },
  
  DB_CONSTRAINT_VIOLATION: {
    title: "Violação de restrição do banco",
    description: "Os dados violam regras de integridade do banco de dados.",
    guidance: [
      "Verifique se a conta de destino ainda existe",
      "Confirme se as categorias selecionadas são válidas",
      "Pode haver um conflito com transações existentes",
      "Tente recarregar a página e importar novamente"
    ],
    severity: "error",
    recoverable: true,
  },
  
  // Permission errors
  PERMISSION_DENIED: {
    title: "Permissão negada",
    description: "Você não tem permissão para realizar esta ação.",
    guidance: [
      "Verifique se você está logado na conta correta",
      "Confirme se tem acesso à conta de destino",
      "Entre em contato com o administrador para solicitar permissão",
      "Faça logout e login novamente se o problema persistir"
    ],
    severity: "error",
    recoverable: false,
  },
  
  ACCOUNT_NOT_FOUND: {
    title: "Conta não encontrada",
    description: "A conta de destino não foi encontrada ou foi removida.",
    guidance: [
      "Verifique se a conta ainda existe",
      "A conta pode ter sido deletada por outro usuário",
      "Recarregue a página para atualizar a lista de contas",
      "Selecione uma conta diferente para importar"
    ],
    severity: "error",
    recoverable: true,
  },
  
  UNAUTHORIZED: {
    title: "Não autorizado",
    description: "Sua sessão expirou ou você não está autenticado.",
    guidance: [
      "Faça login novamente na aplicação",
      "Sua sessão pode ter expirado por inatividade",
      "Após o login, você pode tentar a importação novamente",
      "Seus dados não foram perdidos"
    ],
    severity: "error",
    recoverable: false,
  },
  
  // Validation errors
  VALIDATION_FAILED: {
    title: "Validação falhou",
    description: "Os dados fornecidos não passaram na validação.",
    guidance: [
      "Revise os dados destacados em vermelho",
      "Certifique-se de que todos os campos obrigatórios estão preenchidos",
      "Verifique se os valores estão no formato correto",
      "Corrija os erros e tente novamente"
    ],
    severity: "error",
    recoverable: true,
  },
  
  TRANSACTION_LIMIT_EXCEEDED: {
    title: "Limite de transações excedido",
    description: "O arquivo contém mais de 999 transações.",
    guidance: [
      "Divida a importação em múltiplos arquivos menores",
      "Exporte períodos menores do seu banco (ex: 3 meses em vez de 1 ano)",
      "Importe as transações em lotes de até 999 por vez",
      "Priorize importar primeiro as transações mais recentes"
    ],
    severity: "error",
    recoverable: true,
  },
  
  MISSING_REQUIRED_FIELDS: {
    title: "Campos obrigatórios faltando",
    description: "Algumas transações não têm todos os campos obrigatórios.",
    guidance: [
      "Data, valor e descrição são campos obrigatórios",
      "Transações incompletas serão ignoradas automaticamente",
      "Verifique o arquivo exportado do seu banco",
      "Você pode adicionar transações manualmente após a importação"
    ],
    severity: "warning",
    recoverable: true,
  },
  
  INVALID_DATE_FORMAT: {
    title: "Formato de data inválido",
    description: "Algumas datas não estão no formato esperado.",
    guidance: [
      "Certifique-se de usar o formato correto do seu banco",
      "Não edite o arquivo OFX manualmente",
      "Tente exportar o arquivo novamente",
      "Entre em contato com o suporte do banco se o problema persistir"
    ],
    severity: "error",
    recoverable: true,
  },
  
  INVALID_AMOUNT: {
    title: "Valor inválido",
    description: "Alguns valores monetários estão em formato inválido.",
    guidance: [
      "Valores devem ser números válidos",
      "Não edite valores manualmente no arquivo OFX",
      "Exporte o arquivo novamente do seu banco",
      "Verifique se o arquivo não foi corrompido durante o download"
    ],
    severity: "error",
    recoverable: true,
  },
};

/**
 * Get formatted error message for a given error code
 */
export function getErrorMessage(code: ErrorCode): ErrorMessage {
  return ERROR_MESSAGES[code];
}

/**
 * Format error for display in UI
 */
export function formatErrorForDisplay(code: ErrorCode): {
  title: string;
  description: string;
  actions: string[];
  canRetry: boolean;
} {
  const error = getErrorMessage(code);
  return {
    title: error.title,
    description: error.description,
    actions: error.guidance,
    canRetry: error.recoverable,
  };
}

/**
 * Get user-friendly error message from generic error
 */
export function getUserFriendlyError(error: unknown): ErrorMessage {
  if (typeof error === "string") {
    // Try to match against known error patterns
    const lowerError = error.toLowerCase();
    
    if (lowerError.includes("timeout")) {
      return getErrorMessage("NETWORK_TIMEOUT");
    }
    if (lowerError.includes("network") || lowerError.includes("fetch")) {
      return getErrorMessage("NETWORK_UNAVAILABLE");
    }
    if (lowerError.includes("unauthorized") || lowerError.includes("401")) {
      return getErrorMessage("UNAUTHORIZED");
    }
    if (lowerError.includes("permission") || lowerError.includes("403")) {
      return getErrorMessage("PERMISSION_DENIED");
    }
    if (lowerError.includes("not found") || lowerError.includes("404")) {
      return getErrorMessage("ACCOUNT_NOT_FOUND");
    }
    if (lowerError.includes("database") || lowerError.includes("db")) {
      return getErrorMessage("DB_CONNECTION_FAILED");
    }
  }
  
  // Default error message
  return {
    title: "Erro inesperado",
    description: "Ocorreu um erro inesperado durante a importação.",
    guidance: [
      "Tente novamente em alguns instantes",
      "Verifique sua conexão com a internet",
      "Se o problema persistir, entre em contato com o suporte",
      "Seus dados estão seguros - nenhuma alteração foi feita"
    ],
    severity: "error",
    recoverable: true,
  };
}
