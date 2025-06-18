let arvore: Array<TreeNode> = [];

// TODO a ordem das operações não está sendo respeitada corretamente

/**
 * Cria o estado inicial do analisador sintático
 * @param tokens Lista de tokens a serem analisados
 * @returns Estado inicial do analisador
 */
function criarEstadoInicial(tokens: Token[]): EstadoSintatico {
    return {
        tokens,
        posicaoAtual: 0,
        tokenAtual: tokens.length > 0 ? tokens[0] : null,
    };
}

/**
 * Avança para o próximo token na lista
 * @param estado Estado atual do analisador
 * @returns Novo estado com o próximo token
 */
function avancar(estado: EstadoSintatico): EstadoSintatico {
    const novoEstado = { ...estado };
    novoEstado.posicaoAtual++;

    if (novoEstado.posicaoAtual < novoEstado.tokens.length) {
        novoEstado.tokenAtual = novoEstado.tokens[novoEstado.posicaoAtual];
    } else {
        novoEstado.tokenAtual = null;
    }

    return novoEstado;
}

/**
 * Verifica se o token atual é do tipo esperado
 * @param estado Estado atual do analisador
 * @param tipo Tipo esperado do token
 * @returns True se o token for do tipo esperado
 */
function verificarTipo(estado: EstadoSintatico, tipo: string): boolean {
    return estado.tokenAtual !== null && estado.tokenAtual.tipo === tipo;
}

/**
 * Consome o token atual se for do tipo esperado, caso contrário lança um erro
 * @param estado Estado atual do analisador
 * @param tipo Tipo esperado do token
 * @param mensagem Mensagem de erro caso o token não seja do tipo esperado
 * @returns Novo estado com o próximo token
 */
function consumir(
    estado: EstadoSintatico,
    tipo: string,
    mensagem: string,
    filhos: Array<TreeNode>
): EstadoSintatico {
    if (verificarTipo(estado, tipo)) {
        filhos.push({
            nome: tipo,
            ordem: filhos.length,
            filhos: [
                {
                    nome: estado.tokenAtual!.valor!,
                    ordem: 0,
                    filhos: [],
                    linha: estado.tokenAtual!.linha,
                    coluna: estado.tokenAtual!.coluna,
                },
            ],
        });

        return avancar(estado);
    } else {
        throw new Error(
            `Erro sintático: ${mensagem}. Encontrado: ${estado.tokenAtual?.tipo} (${estado.tokenAtual?.valor})`
        );
    }
}

/**
 * Ponto de entrada para iniciar a análise sintática do programa
 * @param tokens Lista de tokens a serem analisados
 * @returns True se o programa estiver sintaticamente correto
 */
export function analiseSintatica(tokens: Token[]): [boolean, TreeNode[]] {
    try {
        programa(criarEstadoInicial(tokens), arvore);
        return [true, arvore];
    } catch (error) {
        console.error(error);
        return [false, []];
    }
}

/**
 * Verifica se a estrutura do programa está correta
 * programa -> declaracao*
 */
const programa = (
    estado: EstadoSintatico,
    filhos: Array<TreeNode>
): EstadoSintatico => {
    const nodePrograma: TreeNode = {
        nome: "programa",
        ordem: filhos.length,
        filhos: [],
    };

    filhos.push(nodePrograma);

    let estadoAtual = estado;

    while (estadoAtual.tokenAtual !== null) {
        estadoAtual = declaracao(estadoAtual, nodePrograma.filhos);
    }

    return estadoAtual;
};

/**
 * Analisa uma declaração
 * declaracao -> declaracaoVariavel | declaracaoIf | declaracaoWhile | declaracaoReturn | declaracaoFuncao
 */
const declaracao = (
    estado: EstadoSintatico,
    filhos: Array<TreeNode>
): EstadoSintatico => {
    const nodeDeclaracao: TreeNode = {
        nome: "declaracao",
        ordem: filhos.length,
        filhos: [],
    };

    filhos.push(nodeDeclaracao);

    let estadoAtual = estado;

    if (verificarTipo(estadoAtual, "TYPE")) {
        const nodeType = {
            nome: "TYPE",
            ordem: nodeDeclaracao.filhos.length,
            filhos: [
                {
                    nome: estadoAtual.tokenAtual!.valor!,
                    ordem: 0,
                    filhos: [],
                    linha: estadoAtual.tokenAtual!.linha,
                    coluna: estadoAtual.tokenAtual!.coluna,
                },
            ],
        };

        // Pode ser uma declaração de variável ou função
        const tipoToken = estadoAtual.tokenAtual;
        estadoAtual = avancar(estadoAtual);

        // Verificar se é uma função
        if (
            verificarTipo(estadoAtual, "KEYWORD") &&
            estadoAtual.tokenAtual?.valor === "function"
        ) {
            estadoAtual = avancar(estadoAtual);
            return declaracaoFuncao(
                estadoAtual,
                nodeDeclaracao.filhos,
                nodeType
            );
        } else {
            // É uma declaração de variável
            return declaracaoVariavel(
                estadoAtual,
                tipoToken!.valor,
                nodeDeclaracao.filhos,
                nodeType
            );
        }
    } else if (verificarTipo(estadoAtual, "KEYWORD")) {
        if (estadoAtual.tokenAtual?.valor === "if") {
            return declaracaoIf(estadoAtual, nodeDeclaracao.filhos);
        } else if (estadoAtual.tokenAtual?.valor === "while") {
            return declaracaoWhile(estadoAtual, nodeDeclaracao.filhos);
        } else if (estadoAtual.tokenAtual?.valor === "return") {
            return declaracaoReturn(estadoAtual, nodeDeclaracao.filhos);
        } else {
            throw new Error(
                `Erro sintático: Palavra-chave inesperada: ${estadoAtual.tokenAtual?.valor}`
            );
        }
    } else {
        // Pode ser uma atribuição a uma variável existente
        if (verificarTipo(estadoAtual, "IDENTIFIER")) {
            const identificador = estadoAtual.tokenAtual!.valor;
            estadoAtual = avancar(estadoAtual);

            if (
                verificarTipo(estadoAtual, "OPERATOR") &&
                estadoAtual.tokenAtual?.valor === "="
            ) {
                return atribuicao(
                    estadoAtual,
                    identificador,
                    nodeDeclaracao.filhos
                );
            } else if (
                verificarTipo(estadoAtual, "SYMBOL") &&
                estadoAtual.tokenAtual?.valor === "("
            ) {
                // Chamada de função
                estadoAtual = chamadaFuncao(
                    estadoAtual,
                    identificador,
                    nodeDeclaracao.filhos
                );
                return consumir(
                    estadoAtual,
                    "SYMBOL",
                    "Esperado ';' após chamada de função",
                    nodeDeclaracao.filhos
                );
            } else {
                throw new Error(
                    `Erro sintático: Operador de atribuição ou chamada de função esperados após identificador`
                );
            }
        } else {
            throw new Error(
                `Erro sintático: Esperado tipo, palavra-chave ou identificador. Encontrado: ${estadoAtual.tokenAtual?.tipo} (${estadoAtual.tokenAtual?.valor})`
            );
        }
    }
};

/**
 * Analisa uma declaração de variável
 * declaracaoVariavel -> TYPE IDENTIFIER (= expressao)? ;
 */
const declaracaoVariavel = (
    estado: EstadoSintatico,
    tipo: string,
    filhos: Array<TreeNode>,
    nodeType: TreeNode
): EstadoSintatico => {
    const nodeDeclaracaoVariavel: TreeNode = {
        nome: "declaracaoVariavel",
        ordem: filhos.length,
        filhos: [nodeType],
    };

    filhos.push(nodeDeclaracaoVariavel);

    let estadoAtual = consumir(
        estado,
        "IDENTIFIER",
        `Esperado identificador após o tipo ${tipo}`,
        nodeDeclaracaoVariavel.filhos
    );

    if (
        verificarTipo(estadoAtual, "OPERATOR") &&
        estadoAtual.tokenAtual?.valor === "="
    ) {
        nodeDeclaracaoVariavel.filhos.push({
            nome: "OPERATOR",
            ordem: nodeDeclaracaoVariavel.filhos.length,
            filhos: [
                {
                    nome: estadoAtual.tokenAtual!.valor!,
                    ordem: 0,
                    filhos: [],
                    linha: estadoAtual.tokenAtual!.linha,
                    coluna: estadoAtual.tokenAtual!.coluna,
                },
            ],
        });

        estadoAtual = avancar(estadoAtual);
        estadoAtual = expressao(estadoAtual, nodeDeclaracaoVariavel.filhos);
    }

    return consumir(
        estadoAtual,
        "SYMBOL",
        "Esperado ';' após declaração de variável",
        nodeDeclaracaoVariavel.filhos
    );
};

/**
 * Analisa uma atribuição a variável existente
 * atribuicao -> IDENTIFIER = expressao ;
 */
const atribuicao = (
    estado: EstadoSintatico,
    identificador: string,
    filhos: Array<TreeNode>
): EstadoSintatico => {
    const nodeAtribuicao: TreeNode = {
        nome: "atribuicao",
        ordem: filhos.length,
        filhos: [
            {
                nome: "IDENTIFIER",
                ordem: 0,
                filhos: [
                    {
                        nome: identificador,
                        ordem: 0,
                        filhos: [],
                    },
                ],
            },
        ],
    };

    filhos.push(nodeAtribuicao);

    let estadoAtual = consumir(
        estado,
        "OPERATOR",
        `Esperado '=' após identificador ${identificador}`,
        nodeAtribuicao.filhos
    );
    estadoAtual = expressao(estadoAtual, nodeAtribuicao.filhos);

    return consumir(
        estadoAtual,
        "SYMBOL",
        "Esperado ';' após atribuição",
        nodeAtribuicao.filhos
    );
};

/**
 * Analisa uma declaração if
 * declaracaoIf -> if ( expressao ) bloco (else bloco)?
 */
const declaracaoIf = (
    estado: EstadoSintatico,
    filhos: Array<TreeNode>
): EstadoSintatico => {
    const nodeDeclaracaoIf: TreeNode = {
        nome: "declaracaoIf",
        ordem: filhos.length,
        filhos: [
            {
                nome: "KEYWORD",
                ordem: 0,
                filhos: [
                    {
                        nome: "if",
                        ordem: 0,
                        filhos: [],
                    },
                ],
            },
        ],
    };

    filhos.push(nodeDeclaracaoIf);

    let estadoAtual = avancar(estado); // Consome o 'if'

    estadoAtual = consumir(
        estadoAtual,
        "SYMBOL",
        "Esperado '(' após 'if'",
        nodeDeclaracaoIf.filhos
    );
    estadoAtual = expressao(estadoAtual, nodeDeclaracaoIf.filhos);

    estadoAtual = consumir(
        estadoAtual,
        "SYMBOL",
        "Esperado ')' após expressão",
        nodeDeclaracaoIf.filhos
    );
    estadoAtual = bloco(estadoAtual, nodeDeclaracaoIf.filhos);

    // Verificar se tem else (opcional)
    if (
        verificarTipo(estadoAtual, "KEYWORD") &&
        estadoAtual.tokenAtual?.valor === "else"
    ) {
        estadoAtual = avancar(estadoAtual);
        estadoAtual = bloco(estadoAtual, nodeDeclaracaoIf.filhos);
    }

    return estadoAtual;
};

/**
 * Analisa uma declaração while
 * declaracaoWhile -> while ( expressao ) bloco
 */
const declaracaoWhile = (
    estado: EstadoSintatico,
    filhos: Array<TreeNode>
): EstadoSintatico => {
    const nodeDeclaracaoWhile: TreeNode = {
        nome: "declaracaoWhile",
        ordem: filhos.length,
        filhos: [
            {
                nome: "KEYWORD",
                ordem: 0,
                filhos: [
                    {
                        nome: "while",
                        ordem: 0,
                        filhos: [],
                    },
                ],
            },
        ],
    };

    filhos.push(nodeDeclaracaoWhile);

    let estadoAtual = avancar(estado); // Consome o 'while'

    estadoAtual = consumir(
        estadoAtual,
        "SYMBOL",
        "Esperado '(' após 'while'",
        nodeDeclaracaoWhile.filhos
    );
    estadoAtual = expressao(estadoAtual, nodeDeclaracaoWhile.filhos);

    estadoAtual = consumir(
        estadoAtual,
        "SYMBOL",
        "Esperado ')' após expressão",
        nodeDeclaracaoWhile.filhos
    );
    return bloco(estadoAtual, nodeDeclaracaoWhile.filhos);
};

/**
 * Analisa uma declaração return
 * declaracaoReturn -> return expressao? ;
 */
const declaracaoReturn = (
    estado: EstadoSintatico,
    filhos: Array<TreeNode>
): EstadoSintatico => {
    const nodeDeclaracaoReturn: TreeNode = {
        nome: "declaracaoReturn",
        ordem: filhos.length,
        filhos: [
            {
                nome: "KEYWORD",
                ordem: 0,
                filhos: [
                    {
                        nome: "return",
                        ordem: 0,
                        filhos: [],
                    },
                ],
            },
        ],
    };

    filhos.push(nodeDeclaracaoReturn);

    let estadoAtual = avancar(estado); // Consome o 'return'

    // Verificar se tem expressão (opcional)
    if (
        !verificarTipo(estadoAtual, "SYMBOL") ||
        estadoAtual.tokenAtual?.valor !== ";"
    ) {
        estadoAtual = expressao(estadoAtual, nodeDeclaracaoReturn.filhos);
    }

    return consumir(
        estadoAtual,
        "SYMBOL",
        "Esperado ';' após 'return'",
        nodeDeclaracaoReturn.filhos
    );
};

/**
 * Analisa um bloco de código
 * bloco -> { declaracao* }
 */
const bloco = (
    estado: EstadoSintatico,
    filhos: Array<TreeNode>
): EstadoSintatico => {
    const nodeBloco: TreeNode = {
        nome: "bloco",
        ordem: filhos.length,
        filhos: [],
    };

    filhos.push(nodeBloco);

    let estadoAtual = consumir(
        estado,
        "SYMBOL",
        "Esperado '{' para iniciar bloco",
        nodeBloco.filhos
    );

    while (
        estadoAtual.tokenAtual !== null &&
        !(
            verificarTipo(estadoAtual, "SYMBOL") &&
            estadoAtual.tokenAtual.valor === "}"
        )
    ) {
        estadoAtual = declaracao(estadoAtual, nodeBloco.filhos);
    }

    return consumir(
        estadoAtual,
        "SYMBOL",
        "Esperado '}' para fechar bloco",
        nodeBloco.filhos
    );
};

/**
 * Analisa uma declaração de função
 * declaracaoFuncao -> TYPE function IDENTIFIER ( parametros ) bloco
 */
const declaracaoFuncao = (
    estado: EstadoSintatico,
    filhos: Array<TreeNode>,
    nodeType: TreeNode
): EstadoSintatico => {
    const nodeDeclaracaoFuncao: TreeNode = {
        nome: "declaracaoFuncao",
        ordem: filhos.length,
        filhos: [
            nodeType,
            {
                nome: "KEYWORD",
                ordem: 0,
                filhos: [
                    {
                        nome: "function",
                        ordem: 0,
                        filhos: [],
                    },
                ],
            },
        ],
    };

    filhos.push(nodeDeclaracaoFuncao);

    let estadoAtual = consumir(
        estado,
        "IDENTIFIER",
        "Esperado identificador para nome da função",
        nodeDeclaracaoFuncao.filhos
    );
    const nomeFuncao = estadoAtual.tokens[estadoAtual.posicaoAtual - 1].valor;

    estadoAtual = consumir(
        estadoAtual,
        "SYMBOL",
        "Esperado '(' após nome da função",
        nodeDeclaracaoFuncao.filhos
    );

    estadoAtual = parametros(estadoAtual, nodeDeclaracaoFuncao.filhos);

    estadoAtual = consumir(
        estadoAtual,
        "SYMBOL",
        "Esperado ')' após parâmetros",
        nodeDeclaracaoFuncao.filhos
    );

    return bloco(estadoAtual, nodeDeclaracaoFuncao.filhos);
};

/**
 * Analisa os parâmetros de uma função
 * parametros -> (TYPE IDENTIFIER (, TYPE IDENTIFIER)*)?
 */
const parametros = (
    estado: EstadoSintatico,
    filhos: Array<TreeNode>
): EstadoSintatico => {
    const nodeParametros: TreeNode = {
        nome: "parametros",
        ordem: filhos.length,
        filhos: [],
    };

    filhos.push(nodeParametros);

    let estadoAtual = estado;

    // Lista vazia de parâmetros
    if (
        verificarTipo(estadoAtual, "SYMBOL") &&
        estadoAtual.tokenAtual?.valor === ")"
    ) {
        return estadoAtual;
    }

    do {
        estadoAtual = consumir(
            estadoAtual,
            "TYPE",
            "Esperado tipo para parâmetro",
            nodeParametros.filhos
        );
        estadoAtual = consumir(
            estadoAtual,
            "IDENTIFIER",
            "Esperado identificador para parâmetro",
            nodeParametros.filhos
        );

        if (
            !(
                verificarTipo(estadoAtual, "SYMBOL") &&
                estadoAtual.tokenAtual?.valor === ","
            )
        ) {
            break;
        }

        estadoAtual = consumir(
            estadoAtual,
            "SYMBOL",
            "Esperado ',' após parâmetro",
            nodeParametros.filhos
        );
    } while (true);

    return estadoAtual;
};

/**
 * Analisa uma chamada de função
 * chamadaFuncao -> IDENTIFIER ( argumentos )
 */
const chamadaFuncao = (
    estado: EstadoSintatico,
    identificador: string,
    filhos: Array<TreeNode>
): EstadoSintatico => {
    const nodeChamadaFuncao: TreeNode = {
        nome: "chamadaFuncao",
        ordem: filhos.length,
        filhos: [
            {
                nome: "IDENTIFIER",
                ordem: 0,
                filhos: [
                    {
                        nome: identificador,
                        ordem: 0,
                        filhos: [],
                    },
                ],
            },
        ],
    };

    filhos.push(nodeChamadaFuncao);

    let estadoAtual = consumir(
        estado,
        "SYMBOL",
        `Esperado '(' após identificador de função ${identificador}`,
        nodeChamadaFuncao.filhos
    );
    estadoAtual = argumentos(estadoAtual, nodeChamadaFuncao.filhos);

    return consumir(
        estadoAtual,
        "SYMBOL",
        "Esperado ')' após argumentos",
        nodeChamadaFuncao.filhos
    );
};

/**
 * Analisa os argumentos de uma chamada de função
 * argumentos -> (expressao (, expressao)*)?
 */
const argumentos = (
    estado: EstadoSintatico,
    filhos: Array<TreeNode>
): EstadoSintatico => {
    const nodeArgumentos: TreeNode = {
        nome: "argumentos",
        ordem: filhos.length,
        filhos: [],
    };

    filhos.push(nodeArgumentos);

    let estadoAtual = estado;

    // Lista vazia de argumentos
    if (
        verificarTipo(estadoAtual, "SYMBOL") &&
        estadoAtual.tokenAtual?.valor === ")"
    ) {
        return estadoAtual;
    }

    do {
        estadoAtual = expressao(estadoAtual, nodeArgumentos.filhos);

        if (
            !(
                verificarTipo(estadoAtual, "SYMBOL") &&
                estadoAtual.tokenAtual?.valor === ","
            )
        ) {
            break;
        }

        estadoAtual = consumir(
            estadoAtual,
            "SYMBOL",
            "Esperado ',' após argumento",
            nodeArgumentos.filhos
        );
    } while (true);

    return estadoAtual;
};

/**
 * Analisa uma expressão
 * expressao -> termo (operadorBinario termo)*
 */
const expressao = (
    estado: EstadoSintatico,
    filhos: Array<TreeNode>
): EstadoSintatico => {
    const nodeExpressao: TreeNode = {
        nome: "expressao",
        ordem: filhos.length,
        filhos: [],
    };

    filhos.push(nodeExpressao);

    let estadoAtual = termo(estado, nodeExpressao.filhos);

    while (
        verificarTipo(estadoAtual, "OPERATOR") &&
        ["==", "!=", "<", ">", "<=", ">=", "+", "-", "*", "/"].includes(
            estadoAtual.tokenAtual?.valor || ""
        )
    ) {
        nodeExpressao.filhos.push({
            nome: "OPERATOR",
            ordem: nodeExpressao.filhos.length,
            filhos: [
                {
                    nome: estadoAtual.tokenAtual!.valor!,
                    ordem: 0,
                    filhos: [],
                    linha: estadoAtual.tokenAtual!.linha,
                    coluna: estadoAtual.tokenAtual!.coluna,
                },
            ],
        });

        estadoAtual = avancar(estadoAtual); // Consome o operador
        estadoAtual = termo(estadoAtual, nodeExpressao.filhos);
    }

    return estadoAtual;
};

/**
 * Analisa um termo
 * termo -> STRING | INTEGER | BOOLEAN | IDENTIFIER | ( expressao ) | chamadaFuncao
 */
const termo = (
    estado: EstadoSintatico,
    filhos: Array<TreeNode>
): EstadoSintatico => {
    const nodeTermo: TreeNode = {
        nome: "termo",
        ordem: filhos.length,
        filhos: [],
    };

    filhos.push(nodeTermo);

    let estadoAtual = estado;

    if (
        verificarTipo(estadoAtual, "STRING") ||
        verificarTipo(estadoAtual, "INTEGER") ||
        verificarTipo(estadoAtual, "BOOLEAN")
    ) {
        nodeTermo.filhos.push({
            nome: estadoAtual.tokenAtual!.tipo,
            ordem: nodeTermo.filhos.length,
            filhos: [
                {
                    nome: estadoAtual.tokenAtual!.valor!,
                    ordem: 0,
                    filhos: [],
                    linha: estadoAtual.tokenAtual!.linha,
                    coluna: estadoAtual.tokenAtual!.coluna,
                },
            ],
        });

        return avancar(estadoAtual);
    } else if (verificarTipo(estadoAtual, "IDENTIFIER")) {
        const identificador = estadoAtual.tokenAtual!.valor;
        estadoAtual = avancar(estadoAtual);

        // Verificar se é uma chamada de função
        if (
            verificarTipo(estadoAtual, "SYMBOL") &&
            estadoAtual.tokenAtual?.valor === "("
        ) {
            return chamadaFuncao(estadoAtual, identificador, nodeTermo.filhos);
        }
        nodeTermo.filhos.push({
            nome: "IDENTIFIER",
            ordem: nodeTermo.filhos.length,
            filhos: [
                {
                    nome: identificador,
                    ordem: 0,
                    filhos: [],
                },
            ],
        });

        // Caso contrário, é apenas uma referência a variável
        return estadoAtual;
    } else if (
        verificarTipo(estadoAtual, "SYMBOL") &&
        estadoAtual.tokenAtual?.valor === "("
    ) {
        estadoAtual = avancar(estadoAtual);
        estadoAtual = expressao(estadoAtual, nodeTermo.filhos);

        return consumir(
            estadoAtual,
            "SYMBOL",
            "Esperado ')' após expressão",
            nodeTermo.filhos
        );
    } else {
        throw new Error(
            `Erro sintático: Esperado valor ou identificador. Encontrado: ${estadoAtual.tokenAtual?.tipo} (${estadoAtual.tokenAtual?.valor})`
        );
    }
};
