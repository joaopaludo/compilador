/**
 * Interface para definir os atributos de tipo e valor de cada token (léxico)
 */
interface Token {
    tipo: string;
    valor: string;
    linha: number;
    coluna: number;
}

/**
 * Interface para o estado do analisador sintático
 */
interface EstadoSintatico {
    tokens: Token[];
    posicaoAtual: number;
    tokenAtual: Token | null;
}

/**
 * Tipo para definir os nós da árvore sintática
 */
interface TreeNode {
    nome: string;
    ordem: number;
    filhos: TreeNode[];
    linha?: number;
    coluna?: number;

    [key: string]: any;
}

/**
 * Tipos de dados suportados pela linguagem
 */
type TipoDado = "int" | "string" | "boolean" | "void";

/**
 * Interface para um símbolo na tabela de símbolos
 */
interface Simbolo {
    nome: string;
    tipo: TipoDado;
    inicializado: boolean;
    escopo: number;
    linha?: number;
    posicao?: number;
    isFunction?: boolean;
    parametros?: Array<{ nome: string; tipo: TipoDado }>;
}

/**
 * Interface para representar uma entrada na tabela de símbolos
 */
interface TabelaSimbolos {
    [key: string]: Simbolo;
}

/**
 * Interface para o estado da análise semântica
 */
interface EstadoSemantico {
    tabelaSimbolos: TabelaSimbolos;
    escopoAtual: number;
    escopoFuncaoAtual: string | null;
    tipoRetornoEsperado: TipoDado | null;
    erros: string[];
}
