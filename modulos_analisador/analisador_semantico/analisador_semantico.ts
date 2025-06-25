/**
 * Cria o estado inicial da análise semântica
 * @returns Estado inicial da análise semântica
 */
function criarEstadoInicialSemantico(): EstadoSemantico {
    return {
        tabelaSimbolos: {},
        escopoAtual: 0,
        escopoFuncaoAtual: null,
        tipoRetornoEsperado: null,
        erros: [],
    };
}

/**
 * Adiciona um erro à lista de erros
 * @param estado Estado atual da análise
 * @param mensagem Mensagem de erro
 * @param linha Linha onde o erro ocorreu (opcional)
 */
function adicionarErro(
    estado: EstadoSemantico,
    mensagem: string,
    linha?: number,
    coluna?: number
): void {
    if (linha !== undefined) {
        estado.erros.push(`Posição ${linha}:${coluna} - ${mensagem}`);
    } else {
        estado.erros.push(mensagem);
    }
}

/**
 * Obtém a linha de um nó ou de seus filhos
 * @param no Nó da árvore sintática
 * @returns Número da linha ou undefined se não encontrado
 */
function obterLinha(no: TreeNode): number | undefined {
    if (no.linha !== undefined) {
        return no.linha;
    }

    // Procura nos filhos
    for (const filho of no.filhos) {
        const linha = obterLinha(filho);
        if (linha !== undefined) {
            return linha;
        }
    }

    return undefined;
}

/**
 * Obtém a coluna de um nó ou de seus filhos
 * @param no Nó da árvore sintática
 * @returns Número da coluna ou undefined se não encontrado
 */
function obterColuna(no: TreeNode): number | undefined {
    if (no.coluna !== undefined) {
        return no.coluna;
    }

    // Procura nos filhos
    for (const filho of no.filhos) {
        const coluna = obterColuna(filho);
        if (coluna !== undefined) {
            return coluna;
        }
    }

    return undefined;
}

/**
 * Verifica se um tipo é válido na linguagem
 * @param tipo Tipo a ser verificado
 * @returns true se o tipo for válido, false caso contrário
 */
function isTipoValido(tipo: string): boolean {
    return ["int", "string", "boolean", "void"].includes(tipo);
}

/**
 * Adiciona um símbolo à tabela de símbolos
 * @param estado Estado atual da análise
 * @param simbolo Símbolo a ser adicionado
 */
function adicionarSimbolo(estado: EstadoSemantico, simbolo: Simbolo): void {
    // Para funções, usar só o nome; para variáveis, incluir o escopo
    const chave = simbolo.isFunction
        ? simbolo.nome
        : `${simbolo.nome}_${simbolo.escopo}`;
    estado.tabelaSimbolos[chave] = simbolo;
}

/**
 * Busca um símbolo na tabela de símbolos considerando o escopo
 * @param estado Estado atual da análise
 * @param nome Nome do símbolo
 * @returns Símbolo encontrado ou null se não encontrado
 */
function buscarSimbolo(estado: EstadoSemantico, nome: string): Simbolo | null {
    // Primeiro procurar funções (escopo global)
    const funcao = estado.tabelaSimbolos[nome];
    if (funcao && funcao.isFunction) {
        return funcao;
    }

    // Depois procurar variáveis do escopo mais interno para o mais externo
    for (let escopo = estado.escopoAtual; escopo >= 0; escopo--) {
        const chave = `${nome}_${escopo}`;
        const simbolo = estado.tabelaSimbolos[chave];
        if (simbolo) {
            return simbolo;
        }
    }

    return null;
}

/**
 * Busca um símbolo apenas no escopo atual
 * @param estado Estado atual da análise
 * @param nome Nome do símbolo
 * @returns Símbolo encontrado ou null se não encontrado
 */
function buscarSimboloNoEscopoAtual(
    estado: EstadoSemantico,
    nome: string
): Simbolo | null {
    // Para funções no escopo global
    if (estado.escopoAtual === 0) {
        const funcao = estado.tabelaSimbolos[nome];
        if (funcao && funcao.isFunction) {
            return funcao;
        }
    }

    // Para variáveis no escopo atual
    const chave = `${nome}_${estado.escopoAtual}`;
    return estado.tabelaSimbolos[chave] || null;
}

/**
 * Remove todos os símbolos de um determinado escopo
 * @param estado Estado atual da análise
 * @param escopo Escopo a ser limpo
 */
function removerSimbolosDoEscopo(
    estado: EstadoSemantico,
    escopo: number
): void {
    for (const chave in estado.tabelaSimbolos) {
        const simbolo = estado.tabelaSimbolos[chave];
        if (simbolo.escopo === escopo && !simbolo.isFunction) {
            delete estado.tabelaSimbolos[chave];
        }
    }
}

/**
 * Verifica se dois tipos são compatíveis para atribuição
 * @param tipoDestino Tipo de destino
 * @param tipoOrigem Tipo de origem
 * @returns true se os tipos forem compatíveis, false caso contrário
 */
function tiposCompativeis(
    tipoDestino: TipoDado,
    tipoOrigem: TipoDado
): boolean {
    // Tipos idênticos são sempre compatíveis
    if (tipoDestino === tipoOrigem) {
        return true;
    }

    // Regras específicas de compatibilidade (se necessário)
    // Por exemplo, poderíamos permitir int -> string implicitamente

    return false;
}

/**
 * Analisa um nó de termo
 * @param estado Estado atual da análise
 * @param no Nó de termo
 * @returns Tipo do termo
 */
function analisarTermo(
    estado: EstadoSemantico,
    no: TreeNode
): { tipo: TipoDado } {
    for (const filho of no.filhos) {
        if (filho.nome === "INTEGER") {
            return { tipo: "int" };
        } else if (filho.nome === "STRING") {
            return { tipo: "string" };
        } else if (filho.nome === "BOOLEAN") {
            return { tipo: "boolean" };
        } else if (filho.nome === "IDENTIFIER") {
            // Acessar uma variável
            const identificador = filho.filhos[0].nome;
            const simbolo = buscarSimbolo(estado, identificador);
            const linha = obterLinha(filho);
            const coluna = obterColuna(filho);

            if (!simbolo) {
                adicionarErro(
                    estado,
                    `Variável ou função '${identificador}' não declarada`,
                    linha,
                    coluna
                );
                return { tipo: "void" }; // Tipo padrão para evitar erros em cascata
            } else if (!simbolo.inicializado && !simbolo.isFunction) {
                adicionarErro(
                    estado,
                    `Variável '${identificador}' usada antes de ser inicializada`,
                    linha,
                    coluna
                );
            }

            return { tipo: simbolo.tipo };
        } else if (filho.nome === "chamadaFuncao") {
            return analisarChamadaFuncao(estado, filho);
        } else if (filho.nome === "expressao") {
            return analisarExpressao(estado, filho);
        }
    }

    // Se não conseguirmos determinar o tipo, retornamos void
    return { tipo: "void" };
}

/**
 * Analisa um nó de expressão
 * @param estado Estado atual da análise
 * @param no Nó de expressão
 * @returns Tipo da expressão
 */
function analisarExpressao(
    estado: EstadoSemantico,
    no: TreeNode
): { tipo: TipoDado } {
    const termos: { tipo: TipoDado }[] = [];
    const operadores: { valor: string; linha?: number; coluna?: number }[] = [];

    for (const filho of no.filhos) {
        if (filho.nome === "termo") {
            termos.push(analisarTermo(estado, filho));
        } else if (filho.nome === "OPERATOR" && filho.filhos.length > 0) {
            operadores.push({
                valor: filho.filhos[0].nome,
                linha: obterLinha(filho),
                coluna: obterColuna(filho),
            });
        }
    }

    // Se só temos um termo sem operadores, retornamos o tipo do termo
    if (termos.length === 1 && operadores.length === 0) {
        return termos[0];
    }

    // Verificar a semântica dos operadores
    if (termos.length > 1) {
        for (let i = 0; i < operadores.length; i++) {
            const op = operadores[i].valor;
            const linha = operadores[i].linha;
            const coluna = operadores[i].coluna;
            const tipoEsquerda = termos[i].tipo;
            const tipoDireita = termos[i + 1].tipo;

            // Operadores lógicos (and, or) sempre retornam boolean
            if (["and", "or"].includes(op)) {
                // Para operadores lógicos, ambos os lados devem ser boolean
                if (tipoEsquerda !== "boolean" || tipoDireita !== "boolean") {
                    adicionarErro(
                        estado,
                        `Operador '${op}' só pode ser aplicado a valores do tipo boolean, encontrado: ${tipoEsquerda} e ${tipoDireita}`,
                        linha,
                        coluna
                    );
                }
                // O resultado é boolean para operadores lógicos
                return { tipo: "boolean" };
            }
            // Operadores de comparação (==, !=, <, >, <=, >=) sempre retornam boolean
            else if (["==", "!=", "<", ">", "<=", ">="].includes(op)) {
                // Para operadores de comparação, os tipos devem ser compatíveis entre si
                if (!tiposCompativeis(tipoEsquerda, tipoDireita)) {
                    adicionarErro(
                        estado,
                        `Incompatibilidade de tipos para o operador '${op}': ${tipoEsquerda} e ${tipoDireita}`,
                        linha,
                        coluna
                    );
                }
                // O resultado é boolean para operadores de comparação
                return { tipo: "boolean" };
            }
            // Operadores aritméticos (+, -, *, /)
            else if (["+", "-", "*", "/"].includes(op)) {
                // Para +, ambos os lados devem ser int ou pelo menos um ser string (concatenação)
                if (op === "+") {
                    if (tipoEsquerda === "string" || tipoDireita === "string") {
                        return { tipo: "string" };
                    } else if (
                        tipoEsquerda === "int" &&
                        tipoDireita === "int"
                    ) {
                        return { tipo: "int" };
                    } else {
                        adicionarErro(
                            estado,
                            `Operador '+' não pode ser aplicado aos tipos ${tipoEsquerda} e ${tipoDireita}`,
                            linha,
                            coluna
                        );
                        return { tipo: "int" }; // Assumir int para evitar erros em cascata
                    }
                }
                // Para -, *, /, ambos os lados devem ser int
                else {
                    if (tipoEsquerda === "int" && tipoDireita === "int") {
                        return { tipo: "int" };
                    } else {
                        adicionarErro(
                            estado,
                            `Operador '${op}' só pode ser aplicado a valores do tipo int`,
                            linha,
                            coluna
                        );
                        return { tipo: "int" }; // Assumir int para evitar erros em cascata
                    }
                }
            }
        }
    }

    // Se não conseguirmos determinar o tipo, retornamos o tipo do primeiro termo
    return termos[0] || { tipo: "void" };
}

/**
 * Analisa os argumentos de uma chamada de função
 * @param estado Estado atual da análise
 * @param no Nó de argumentos
 * @param argumentosExpressao Array para armazenar os tipos dos argumentos
 */
function analisarArgumentos(
    estado: EstadoSemantico,
    no: TreeNode,
    argumentosExpressao: { tipo: TipoDado }[]
): void {
    for (const filho of no.filhos) {
        if (filho.nome === "expressao") {
            const resultado = analisarExpressao(estado, filho);
            argumentosExpressao.push(resultado);
        }
    }
}

/**
 * Analisa um nó de chamada de função
 * @param estado Estado atual da análise
 * @param no Nó de chamada de função
 * @returns Tipo de retorno da função
 */
function analisarChamadaFuncao(
    estado: EstadoSemantico,
    no: TreeNode
): { tipo: TipoDado } {
    let nomeFuncao: string | null = null;
    const argumentosExpressao: { tipo: TipoDado }[] = [];
    let linha: number | undefined = obterLinha(no);
    let coluna: number | undefined = obterColuna(no);

    // Pegar o identificador da função (deve estar antes do nó de chamada de função)
    const decl = no.filhos
        ? no.filhos.find((f) => f.nome === "IDENTIFIER")
        : null;
    if (decl && decl.filhos && decl.filhos.length > 0) {
        nomeFuncao = decl.filhos[0].nome;
        if (linha === undefined) {
            linha = obterLinha(decl);
        }
        if (coluna === undefined) {
            coluna = obterColuna(decl);
        }
    }

    // Analisar os argumentos
    for (const filho of no.filhos) {
        if (filho.nome === "argumentos") {
            analisarArgumentos(estado, filho, argumentosExpressao);
        }
    }

    // Verificar se a função existe
    if (nomeFuncao) {
        const simbolo = buscarSimbolo(estado, nomeFuncao);
        if (!simbolo) {
            adicionarErro(
                estado,
                `Função '${nomeFuncao}' não declarada`,
                linha,
                coluna
            );
            return { tipo: "void" }; // Retorno padrão para evitar erros em cascata
        } else if (!simbolo.isFunction) {
            adicionarErro(estado, `'${nomeFuncao}' não é uma função`, linha);
            return { tipo: "void" };
        } else {
            // Verificar número de argumentos
            if (
                simbolo.parametros &&
                simbolo.parametros.length !== argumentosExpressao.length
            ) {
                adicionarErro(
                    estado,
                    `Número incorreto de argumentos para a função '${nomeFuncao}': esperado ${simbolo.parametros.length}, encontrado ${argumentosExpressao.length}`,
                    linha,
                    coluna
                );
            } else if (simbolo.parametros) {
                // Verificar tipos dos argumentos
                for (let i = 0; i < argumentosExpressao.length; i++) {
                    if (
                        !tiposCompativeis(
                            simbolo.parametros[i].tipo,
                            argumentosExpressao[i].tipo
                        )
                    ) {
                        adicionarErro(
                            estado,
                            `Incompatibilidade de tipos no argumento ${i + 1
                            } da função '${nomeFuncao}': esperado ${simbolo.parametros[i].tipo
                            }, encontrado ${argumentosExpressao[i].tipo}`,
                            linha,
                            coluna
                        );
                    }
                }
            }

            return { tipo: simbolo.tipo };
        }
    }

    return { tipo: "void" };
}

/**
 * Analisa um nó de atribuição
 * @param estado Estado atual da análise
 * @param no Nó de atribuição
 */
function analisarAtribuicao(estado: EstadoSemantico, no: TreeNode): void {
    let identificador: string | null = null;
    let valorExpressao: { tipo: TipoDado } | null = null;
    let linha: number | undefined = obterLinha(no);
    let coluna: number | undefined = obterColuna(no);

    // Identificador deve estar antes do nó de atribuição
    const decl = no.filhos
        ? no.filhos.find((f) => f.nome === "IDENTIFIER")
        : null;
    if (decl && decl.filhos && decl.filhos.length > 0) {
        identificador = decl.filhos[0].nome;
        if (linha === undefined) {
            linha = obterLinha(decl);
        }
        if (coluna === undefined) {
            coluna = obterColuna(decl);
        }
    }

    // Analisar a expressão à direita da atribuição
    for (const filho of no.filhos) {
        if (filho.nome === "expressao") {
            valorExpressao = analisarExpressao(estado, filho);
        }
    }

    // Verificar se a variável existe
    if (identificador) {
        const simbolo = buscarSimbolo(estado, identificador);
        if (!simbolo) {
            adicionarErro(
                estado,
                `Variável '${identificador}' não declarada`,
                linha,
                coluna
            );
        } else if (simbolo.isFunction) {
            adicionarErro(
                estado,
                `Não é possível atribuir valor a uma função: '${identificador}'`,
                linha,
                coluna
            );
        } else if (valorExpressao) {
            // Verificar compatibilidade de tipos
            if (!tiposCompativeis(simbolo.tipo, valorExpressao.tipo)) {
                adicionarErro(
                    estado,
                    `Incompatibilidade de tipos: não é possível atribuir ${valorExpressao.tipo} a ${simbolo.tipo}`,
                    linha,
                    coluna
                );
            }

            // Marcar variável como inicializada
            simbolo.inicializado = true;
        }
    }
}

/**
 * Analisa um nó de declaração return
 * @param estado Estado atual da análise
 * @param no Nó de declaração return
 */
function analisarDeclaracaoReturn(estado: EstadoSemantico, no: TreeNode): void {
    const linha = obterLinha(no);
    const coluna = obterColuna(no);

    // Verificar se estamos dentro de uma função
    if (!estado.escopoFuncaoAtual) {
        adicionarErro(
            estado,
            "Instrução 'return' fora de uma função",
            linha,
            coluna
        );
        return;
    }

    let tipoRetorno: TipoDado | null = null;

    // Verificar se há uma expressão de retorno
    for (const filho of no.filhos) {
        if (filho.nome === "expressao") {
            const resultadoExpressao = analisarExpressao(estado, filho);
            tipoRetorno = resultadoExpressao.tipo;
        }
    }

    // Se não houver expressão, considerar como void
    if (!tipoRetorno) {
        tipoRetorno = "void";
    }

    // Verificar se o tipo de retorno é compatível com o tipo da função
    if (
        estado.tipoRetornoEsperado &&
        !tiposCompativeis(estado.tipoRetornoEsperado, tipoRetorno)
    ) {
        adicionarErro(
            estado,
            `Incompatibilidade de tipos no retorno: função '${estado.escopoFuncaoAtual}' espera ${estado.tipoRetornoEsperado}, encontrado ${tipoRetorno}`,
            linha,
            coluna
        );
    }
}

/**
 * Analisa um nó de declaração while
 * @param estado Estado atual da análise
 * @param no Nó de declaração while
 */
function analisarDeclaracaoWhile(estado: EstadoSemantico, no: TreeNode): void {
    const linha = obterLinha(no);
    const coluna = obterColuna(no);

    for (const filho of no.filhos) {
        if (filho.nome === "expressao") {
            const resultadoExpressao = analisarExpressao(estado, filho);
            // A condição do while deve ser do tipo boolean
            if (resultadoExpressao.tipo !== "boolean") {
                adicionarErro(
                    estado,
                    `A condição de um 'while' deve ser do tipo boolean, encontrado: ${resultadoExpressao.tipo}`,
                    linha,
                    coluna
                );
            }
        } else if (filho.nome === "bloco") {
            analisarBloco(estado, filho);
        }
    }
}

/**
 * Analisa um nó de declaração if
 * @param estado Estado atual da análise
 * @param no Nó de declaração if
 */
function analisarDeclaracaoIf(estado: EstadoSemantico, no: TreeNode): void {
    const linha = obterLinha(no);
    const coluna = obterColuna(no);

    for (const filho of no.filhos) {
        if (filho.nome === "expressao") {
            const resultadoExpressao = analisarExpressao(estado, filho);
            // A condição do if deve ser do tipo boolean
            if (resultadoExpressao.tipo !== "boolean") {
                adicionarErro(
                    estado,
                    `A condição de um 'if' deve ser do tipo boolean, encontrado: ${resultadoExpressao.tipo}`,
                    linha,
                    coluna
                );
            }
        } else if (filho.nome === "blocoIf") {
            // Analisar o bloco do if
            analisarBloco(estado, filho);
        } else if (filho.nome === "blocoElse") {
            // Analisar o bloco do else
            analisarBloco(estado, filho);
        } else if (filho.nome === "bloco") {
            // Manter compatibilidade com a estrutura antiga
            analisarBloco(estado, filho);
        }
    }
}

/**
 * Analisa os parâmetros de uma função
 * @param estado Estado atual da análise
 * @param no Nó de parâmetros
 * @param parametros Array para armazenar os parâmetros analisados
 */
function analisarParametros(
    estado: EstadoSemantico,
    no: TreeNode,
    parametros: Array<{ nome: string; tipo: TipoDado }>
): void {
    let tipo: TipoDado | null = null;
    let nome: string | null = null;
    let linha: number | undefined;
    let coluna: number | undefined;

    for (const filho of no.filhos) {
        if (filho.nome === "TYPE" && filho.filhos.length > 0) {
            const tipoValor = filho.filhos[0].nome;
            linha = obterLinha(filho);
            coluna = obterColuna(filho);
            if (isTipoValido(tipoValor)) {
                tipo = tipoValor as TipoDado;
            } else {
                adicionarErro(
                    estado,
                    `Tipo de parâmetro inválido: ${tipoValor}`,
                    linha,
                    coluna
                );
            }
        } else if (filho.nome === "IDENTIFIER" && filho.filhos.length > 0) {
            nome = filho.filhos[0].nome;
            if (linha === undefined) {
                linha = obterLinha(filho);
            }
            if (coluna === undefined) {
                coluna = obterColuna(filho);
            }

            // Verificar se o nome já foi usado em outro parâmetro
            const paramExistente = parametros.find((p) => p.nome === nome);
            if (paramExistente) {
                adicionarErro(
                    estado,
                    `Parâmetro '${nome}' já declarado na mesma função`,
                    linha,
                    coluna
                );
            } else if (tipo) {
                // Adicionar parâmetro à lista
                parametros.push({ nome, tipo });
                // Resetar tipo para o próximo parâmetro
                tipo = null;
            }
        }
    }
}

/**
 * Analisa um nó de declaração de função
 * @param estado Estado atual da análise
 * @param no Nó de declaração de função
 */
function analisarDeclaracaoFuncao(estado: EstadoSemantico, no: TreeNode): void {
    let tipoRetorno: TipoDado | null = null;
    let nome: string | null = null;
    const parametros: Array<{ nome: string; tipo: TipoDado }> = [];
    let linha: number | undefined = obterLinha(no);
    let coluna: number | undefined = obterColuna(no);

    for (const filho of no.filhos) {
        if (filho.nome === "TYPE" && filho.filhos.length > 0) {
            const tipoValor = filho.filhos[0].nome;
            if (linha === undefined) {
                linha = obterLinha(filho);
            }
            if (coluna === undefined) {
                coluna = obterColuna(filho);
            }
            if (isTipoValido(tipoValor)) {
                tipoRetorno = tipoValor as TipoDado;
            } else {
                adicionarErro(
                    estado,
                    `Tipo de retorno inválido: ${tipoValor}`,
                    linha,
                    coluna
                );
            }
        } else if (filho.nome === "IDENTIFIER" && filho.filhos.length > 0) {
            nome = filho.filhos[0].nome;
            if (linha === undefined) {
                linha = obterLinha(filho);
            }
            if (coluna === undefined) {
                coluna = obterColuna(filho);
            }
        } else if (filho.nome === "parametros") {
            analisarParametros(estado, filho, parametros);
        }
    }

    if (tipoRetorno && nome) {
        const simboloExistente = buscarSimboloNoEscopoAtual(estado, nome);
        if (simboloExistente) {
            adicionarErro(
                estado,
                `Função '${nome}' já declarada no escopo atual`,
                linha,
                coluna
            );
        } else {
            adicionarSimbolo(estado, {
                nome,
                tipo: tipoRetorno,
                inicializado: true,
                escopo: estado.escopoAtual,
                linha: linha,
                isFunction: true,
                parametros,
            });

            // Salvar contexto atual
            const escopoAnterior = estado.escopoAtual;
            const funcaoAnterior = estado.escopoFuncaoAtual;
            const tipoRetornoAnterior = estado.tipoRetornoEsperado;

            // Configurar novo contexto para o corpo da função
            estado.escopoAtual++;
            estado.escopoFuncaoAtual = nome;
            estado.tipoRetornoEsperado = tipoRetorno;

            // Adicionar parâmetros à tabela de símbolos no escopo da função
            for (const param of parametros) {
                adicionarSimbolo(estado, {
                    nome: param.nome,
                    tipo: param.tipo,
                    inicializado: true,
                    escopo: estado.escopoAtual,
                    linha: linha,
                });
            }

            // Analisar corpo da função
            for (const filho of no.filhos) {
                if (filho.nome === "bloco") {
                    analisarBloco(estado, filho);
                }
            }

            // Restaurar contexto anterior
            estado.escopoAtual = escopoAnterior;
            estado.escopoFuncaoAtual = funcaoAnterior;
            estado.tipoRetornoEsperado = tipoRetornoAnterior;
        }
    }
}

/**
 * Analisa um nó de declaração de variável
 * @param estado Estado atual da análise
 * @param no Nó de declaração de variável
 */
function analisarDeclaracaoVariavel(
    estado: EstadoSemantico,
    no: TreeNode
): void {
    let tipo: TipoDado | null = null;
    let nome: string | null = null;
    let temInicializacao = false;
    let valorExpressao: { tipo: TipoDado } | null = null;
    let linha: number | undefined = obterLinha(no);
    let coluna: number | undefined = obterColuna(no);

    for (const filho of no.filhos) {
        if (filho.nome === "TYPE" && filho.filhos.length > 0) {
            const tipoValor = filho.filhos[0].nome;
            if (linha === undefined) {
                linha = obterLinha(filho);
            }
            if (coluna === undefined) {
                coluna = obterColuna(filho);
            }
            if (isTipoValido(tipoValor)) {
                tipo = tipoValor as TipoDado;
            } else {
                adicionarErro(
                    estado,
                    `Tipo inválido: ${tipoValor}`,
                    linha,
                    coluna
                );
            }
        } else if (filho.nome === "IDENTIFIER" && filho.filhos.length > 0) {
            nome = filho.filhos[0].nome;
            if (linha === undefined) {
                linha = obterLinha(filho);
            }
            if (coluna === undefined) {
                coluna = obterColuna(filho);
            }
        } else if (
            filho.nome === "OPERATOR" &&
            filho.filhos.length > 0 &&
            filho.filhos[0].nome === "="
        ) {
            temInicializacao = true;
        } else if (filho.nome === "expressao") {
            valorExpressao = analisarExpressao(estado, filho);
        }
    }

    if (tipo && nome) {
        const simboloExistente = buscarSimboloNoEscopoAtual(estado, nome);
        if (simboloExistente) {
            adicionarErro(
                estado,
                `Variável '${nome}' já declarada no escopo atual`,
                linha,
                coluna
            );
        } else {
            adicionarSimbolo(estado, {
                nome,
                tipo,
                inicializado: temInicializacao,
                escopo: estado.escopoAtual,
                linha: linha,
            });

            // Verificar compatibilidade de tipo na inicialização
            if (temInicializacao && valorExpressao) {
                if (!tiposCompativeis(tipo, valorExpressao.tipo)) {
                    adicionarErro(
                        estado,
                        `Incompatibilidade de tipos: não é possível atribuir ${valorExpressao.tipo} a ${tipo}`,
                        linha,
                        coluna
                    );
                }
            }
        }
        // Continuação da função analisarDeclaracaoVariavel
    } else if (nome) {
        // Se o tipo não foi definido, mas o nome foi, adicionar como variável sem tipo
        const simboloExistente = buscarSimboloNoEscopoAtual(estado, nome);
        if (simboloExistente) {
            adicionarErro(
                estado,
                `Variável '${nome}' já declarada no escopo atual`,
                linha,
                coluna
            );
        } else {
            adicionarSimbolo(estado, {
                nome,
                tipo: "void",
                inicializado: temInicializacao,
                escopo: estado.escopoAtual,
                linha: linha,
            });
        }
    }
}

/**
 * Analisa um bloco de código
 * @param estado Estado atual da análise
 * @param no Nó de bloco
 */
function analisarBloco(estado: EstadoSemantico, no: TreeNode): void {
    // Incrementar o escopo ao entrar no bloco
    estado.escopoAtual++;

    // Analisar todas as declarações no bloco
    for (const filho of no.filhos) {
        if (filho.nome === "declaracao") {
            analisarDeclaracao(estado, filho);
        } else if (filho.nome === "SYMBOL" && filho.filhos.length > 0) {
            // Ignorar símbolos de início e fim de bloco
            continue;
        }
    }

    // Limpar símbolos do escopo atual antes de sair
    removerSimbolosDoEscopo(estado, estado.escopoAtual);

    // Decrementar o escopo ao sair do bloco
    estado.escopoAtual--;
}

/**
 * Analisa um nó de declaração
 * @param estado Estado atual da análise
 * @param no Nó de declaração
 */
function analisarDeclaracao(estado: EstadoSemantico, no: TreeNode): void {
    for (const filho of no.filhos) {
        switch (filho.nome) {
            case "declaracaoVariavel":
                analisarDeclaracaoVariavel(estado, filho);
                break;
            case "declaracaoFuncao":
                analisarDeclaracaoFuncao(estado, filho);
                break;
            case "declaracaoIf":
                analisarDeclaracaoIf(estado, filho);
                break;
            case "declaracaoWhile":
                analisarDeclaracaoWhile(estado, filho);
                break;
            case "declaracaoReturn":
                analisarDeclaracaoReturn(estado, filho);
                break;
            case "atribuicao":
                analisarAtribuicao(estado, filho);
                break;
            case "chamadaFuncao":
                analisarChamadaFuncao(estado, filho);
                break;
        }
    }
}

/**
 * Analisa o nó do programa
 * @param estado Estado atual da análise
 * @param no Nó do programa
 */
function analisarPrograma(estado: EstadoSemantico, no: TreeNode): void {
    for (const filho of no.filhos) {
        if (filho.nome === "declaracao") {
            analisarDeclaracao(estado, filho);
        }
    }
}

/**
 * Função principal para realizar a análise semântica
 * @param arvore Árvore sintática a ser analisada
 * @returns Resultado da análise: [sucesso, erros]
 */
export function analiseSemantica(arvore: TreeNode[]): [boolean, string[]] {
    const estado = criarEstadoInicialSemantico();

    try {
        if (arvore.length > 0 && arvore[0].nome === "programa") {
            analisarPrograma(estado, arvore[0]);
        } else {
            adicionarErro(
                estado,
                "Árvore sintática inválida: não começa com 'programa'"
            );
        }
    } catch (error) {
        if (error instanceof Error) {
            adicionarErro(estado, error.message);
        } else {
            adicionarErro(
                estado,
                "Erro desconhecido durante a análise semântica"
            );
        }
    }

    return [estado.erros.length === 0, estado.erros];
}
