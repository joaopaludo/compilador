// Gerador de código Assembly RISC-V

let registradorAtual = 0;
let registradoresLivres: number[] = [];
let labelCounter = 0;

function novoRegistrador(): string {
    if (registradoresLivres.length > 0) {
        return `t${registradoresLivres.shift()!}`;
    }
    return `t${registradorAtual++}`;
}

function liberarRegistrador(reg: string) {
    const num = parseInt(reg.substring(1));
    if (num >= 0) {
        registradoresLivres.push(num);
    }
}

function novoLabel(): string {
    return `label_${labelCounter++}`;
}

export function gerarAssembly(no: TreeNode): string[] {
    const codigo: string[] = [".data"];

    // Mapa para rastrear registradores associados a variáveis
    const variaveisDeclaradas = new Set<string>();

    // Primeiro passo: coletar todas as variáveis e adicioná-las à seção .data
    function coletarVariaveis(no: TreeNode) {
        if (no.nome === "declaracao") {
            const declaracao = no.filhos[0];
            if (declaracao.nome === "declaracaoVariavel") {
                const identificador = declaracao.filhos.find(
                    (f) => f.nome === "IDENTIFIER"
                )?.filhos[0].nome;
                if (identificador && !variaveisDeclaradas.has(identificador)) {
                    codigo.push(`${identificador}: .word 0`);
                    variaveisDeclaradas.add(identificador);
                }
            }
        }
        no.filhos.forEach(coletarVariaveis);
    }

    coletarVariaveis(no);

    // Adicionar seção .text e jump para main
    codigo.push(".text");
    codigo.push("j main");

    function gerarExpressao(no: TreeNode): { codigo: string[]; reg: string } {
        const codigo: string[] = [];
        let reg = "";

        if (no.nome === "expressao") {
            const operadores = no.filhos
                .filter((f) => f.nome === "OPERATOR")
                .map((f) => f.filhos[0].nome);
            const termos = no.filhos.filter((f) => f.nome === "termo");

            if (termos.length === 1) {
                const resultado = gerarTermo(termos[0]);
                codigo.push(...resultado.codigo);
                reg = resultado.reg;
            } else {
                // Primeiro processa multiplicação e divisão
                let resultadoAtual = gerarTermo(termos[0]);
                codigo.push(...resultadoAtual.codigo);
                reg = resultadoAtual.reg;

                for (let i = 0; i < operadores.length; i++) {
                    const operador = operadores[i];

                    // Se é multiplicação ou divisão, processa imediatamente
                    if (operador === "*" || operador === "/") {
                        const proximoResultado = gerarTermo(termos[i + 1]);
                        codigo.push(...proximoResultado.codigo);

                        const novoReg = novoRegistrador();
                        if (operador === "*") {
                            codigo.push(
                                `\tmul ${novoReg}, ${reg}, ${proximoResultado.reg}`
                            );
                        } else if (operador === "/") {
                            codigo.push(
                                `\tdiv ${novoReg}, ${reg}, ${proximoResultado.reg}`
                            );
                        }

                        liberarRegistrador(reg);
                        liberarRegistrador(proximoResultado.reg);
                        reg = novoReg;
                    } else {
                        // Para outros operadores, apenas avança
                        continue;
                    }
                }

                // Agora processa soma, subtração e comparações
                let j = 0;
                for (let i = 0; i < operadores.length; i++) {
                    const operador = operadores[i];

                    // Pula multiplicação e divisão que já foram processadas
                    if (operador === "*" || operador === "/") {
                        j++;
                        continue;
                    }

                    const proximoResultado = gerarTermo(termos[j + 1]);
                    codigo.push(...proximoResultado.codigo);

                    const novoReg = novoRegistrador();
                    if (operador === "+") {
                        codigo.push(
                            `\tadd ${novoReg}, ${reg}, ${proximoResultado.reg}`
                        );
                    } else if (operador === "-") {
                        codigo.push(
                            `\tsub ${novoReg}, ${reg}, ${proximoResultado.reg}`
                        );
                    } else if (operador === "<") {
                        codigo.push(
                            `\tslt ${novoReg}, ${reg}, ${proximoResultado.reg}`
                        );
                    } else if (operador === ">") {
                        codigo.push(
                            `\tslt ${novoReg}, ${proximoResultado.reg}, ${reg}`
                        );
                    } else if (operador === "<=") {
                        codigo.push(
                            `\tslt ${novoReg}, ${proximoResultado.reg}, ${reg}`,
                            `\txori ${novoReg}, ${novoReg}, 1`
                        );
                    } else if (operador === ">=") {
                        codigo.push(
                            `\tslt ${novoReg}, ${reg}, ${proximoResultado.reg}`,
                            `\txori ${novoReg}, ${novoReg}, 1`
                        );
                    } else if (operador === "==") {
                        codigo.push(
                            `\tsub ${novoReg}, ${reg}, ${proximoResultado.reg}`,
                            `\tsltiu ${novoReg}, ${novoReg}, 1`
                        );
                    } else if (operador === "!=") {
                        codigo.push(
                            `\tsub ${novoReg}, ${reg}, ${proximoResultado.reg}`,
                            `\tsltu ${novoReg}, zero, ${novoReg}`
                        );
                    }

                    liberarRegistrador(reg);
                    liberarRegistrador(proximoResultado.reg);
                    reg = novoReg;
                    j++;
                }
            }
        }

        return { codigo, reg };
    }

    function gerarDeclaracao(no: TreeNode) {
        if (no.nome === "declaracao") {
            const declaracao = no.filhos[0];
            if (declaracao.nome === "declaracaoVariavel") {
                const identificador = declaracao.filhos.find(
                    (f) => f.nome === "IDENTIFIER"
                )?.filhos[0].nome;
                const expressao = declaracao.filhos.find(
                    (f) => f.nome === "expressao"
                );

                if (expressao && identificador) {
                    const resultado = gerarExpressao(expressao);
                    codigo.push(...resultado.codigo);
                    const enderecoReg = novoRegistrador();
                    codigo.push(
                        `\tla ${enderecoReg}, ${identificador}`,
                        `\tsw ${resultado.reg}, (${enderecoReg})`
                    );
                    liberarRegistrador(enderecoReg);
                    liberarRegistrador(resultado.reg);
                }
            } else if (declaracao.nome === "declaracaoFuncao") {
                const identificador = declaracao.filhos.find(
                    (f) => f.nome === "IDENTIFIER"
                )?.filhos[0].nome;
                const bloco = declaracao.filhos.find((f) => f.nome === "bloco");

                if (identificador) {
                    codigo.push(`fun_${identificador}:`);

                    const parametros = declaracao.filhos.find(
                        (f) => f.nome === "parametros"
                    );

                    let parametrosRegistradores: string[] = [];
                    if (parametros) {
                        parametrosRegistradores = parametros.filhos
                            .filter((f) => f.nome === "IDENTIFIER")
                            .map((_, i) => {
                                const reg = novoRegistrador();
                                codigo.push(`\tmv ${reg}, a${i}`);

                                return reg;
                            });
                    }

                    gerarBloco(bloco!);

                    parametrosRegistradores.forEach((reg) => {
                        liberarRegistrador(reg);
                    });
                }
            } else if (declaracao.nome === "declaracaoWhile") {
                const expressao = declaracao.filhos.find(
                    (f) => f.nome === "expressao"
                );
                const bloco = declaracao.filhos.find((f) => f.nome === "bloco");

                if (expressao && bloco) {
                    const inicioLabel = novoLabel();
                    const fimLabel = novoLabel();

                    // Label de início do loop
                    codigo.push(`${inicioLabel}:`);

                    // Gera a condição (a expressão do while é uma comparação)
                    const resultadoCondicao = gerarExpressao(expressao);
                    codigo.push(...resultadoCondicao.codigo);

                    // A expressão já retorna o resultado da comparação (0 ou 1)
                    // Se a condição for falsa (0), pula para o fim
                    codigo.push(`\tbeqz ${resultadoCondicao.reg}, ${fimLabel}`);
                    liberarRegistrador(resultadoCondicao.reg);

                    // Gera o corpo do loop
                    gerarBloco(bloco);

                    // Volta para o início do loop
                    codigo.push(`\tj ${inicioLabel}`);

                    // Label de fim do loop
                    codigo.push(`${fimLabel}:`);
                }
            } else if (declaracao.nome === "atribuicao") {
                const identificador = declaracao.filhos.find(
                    (f) => f.nome === "IDENTIFIER"
                )?.filhos[0].nome;
                const expressao = declaracao.filhos.find(
                    (f) => f.nome === "expressao"
                );

                // TODO
                // verificar se o identificador aqui é um parâmetro de função
                // se for, não deve carregar do endereço, mas usar o a0, a1, etc.
                if (!variaveisDeclaradas.has(identificador!) && identificador) {
                    // verificar o no pai do pai do pai... se é uma função
                    // se for, não deve usar a variável, mas usar o registrador a0, a1, etc.
                }

                if (identificador && expressao) {
                    const resultado = gerarExpressao(expressao);
                    codigo.push(...resultado.codigo);

                    const enderecoReg = novoRegistrador();
                    codigo.push(
                        `\tla ${enderecoReg}, ${identificador}`,
                        `\tsw ${resultado.reg}, (${enderecoReg})`
                    );
                    liberarRegistrador(enderecoReg);
                    liberarRegistrador(resultado.reg);
                }
            } else if (declaracao.nome === "declaracaoIf") {
                const expressao = declaracao.filhos.find(
                    (f) => f.nome === "expressao"
                );
                const bloco = declaracao.filhos.find((f) => f.nome === "bloco");

                if (expressao && bloco) {
                    const fimLabel = novoLabel();

                    // Gera a condição
                    const resultadoCondicao = gerarExpressao(expressao);
                    codigo.push(...resultadoCondicao.codigo);

                    // Se a condição for falsa (0), pula para o fim
                    codigo.push(`\tbeqz ${resultadoCondicao.reg}, ${fimLabel}`);
                    liberarRegistrador(resultadoCondicao.reg);

                    // Gera o corpo do if
                    gerarBloco(bloco);

                    // Label de fim do if
                    codigo.push(`${fimLabel}:`);
                }
            } else if (declaracao.nome === "declaracaoReturn") {
                const expressao = declaracao.filhos.find(
                    (f) => f.nome === "expressao"
                );

                if (expressao) {
                    const resultado = gerarExpressao(expressao);
                    codigo.push(...resultado.codigo);

                    // Move o resultado para a0 (registrador de retorno)
                    codigo.push(`\tmv a0, ${resultado.reg}`);
                    liberarRegistrador(resultado.reg);
                }

                // Retorna da função
                codigo.push(`\tret`);
            }
        }
    }

    function gerarChamadaFuncao(chamadaFuncao: TreeNode): {
        codigo: string[];
        reg: string;
    } {
        const codigo: string[] = [];
        const identificador = chamadaFuncao.filhos.find(
            (f) => f.nome === "IDENTIFIER"
        )?.filhos[0].nome;
        const argumentos = chamadaFuncao.filhos.find(
            (f) => f.nome === "argumentos"
        );

        if (identificador) {
            if (argumentos) {
                const args = argumentos.filhos;

                // Primeiro gera todos os argumentos
                const resultados = args
                    .map((arg) => {
                        const resultado = gerarExpressao(arg);

                        codigo.push(...resultado.codigo);
                        return resultado.reg;
                    })
                    .filter(Boolean);

                resultados.forEach((reg, index) => {
                    codigo.push(`\tmv a${index}, ${reg}`);
                    liberarRegistrador(reg);
                });
            }

            // Chama a função
            codigo.push(`\tcall fun_${identificador}`);

            // O resultado da função está em a0
            const reg = novoRegistrador();
            codigo.push(`\tmv ${reg}, a0`);
            return { codigo, reg };
        }
        return { codigo: [], reg: "" };
    }

    function gerarTermo(no: TreeNode): { codigo: string[]; reg: string } {
        const codigo: string[] = [];
        let reg = "";

        // Verifica se é uma chamada de função
        const chamadaFuncao = no.filhos.find((f) => f.nome === "chamadaFuncao");
        if (chamadaFuncao) {
            return gerarChamadaFuncao(chamadaFuncao);
        }

        // Verifica se o termo contém uma expressão (parênteses)
        const expressao = no.filhos.find((f) => f.nome === "expressao");
        if (expressao) {
            return gerarExpressao(expressao);
        }

        if (no.filhos[0].nome === "INTEGER") {
            reg = novoRegistrador();
            codigo.push(`\tli ${reg}, ${no.filhos[0].filhos[0].nome}`);
        } else if (no.filhos[0].nome === "IDENTIFIER") {
            reg = novoRegistrador();
            const enderecoReg = novoRegistrador();
            codigo.push(
                `\tla ${enderecoReg}, ${no.filhos[0].filhos[0].nome}`,
                `\tlw ${reg}, (${enderecoReg})`
            );
            liberarRegistrador(enderecoReg);
        }

        return { codigo, reg };
    }

    function gerarComparacao(no: TreeNode): { codigo: string[]; reg: string } {
        const codigo: string[] = [];
        let reg = "";

        if (no.nome === "comparacao") {
            const operador = no.filhos.find((f) => f.nome === "OPERATOR")
                ?.filhos[0].nome;
            const expressoes = no.filhos.filter((f) => f.nome === "expressao");

            if (expressoes.length === 2 && operador) {
                const resultado1 = gerarExpressao(expressoes[0]);
                const resultado2 = gerarExpressao(expressoes[1]);

                codigo.push(...resultado1.codigo);
                codigo.push(...resultado2.codigo);

                reg = novoRegistrador();

                if (operador === "<") {
                    codigo.push(
                        `\tslt ${reg}, ${resultado1.reg}, ${resultado2.reg}`
                    );
                } else if (operador === ">") {
                    codigo.push(
                        `\tslt ${reg}, ${resultado2.reg}, ${resultado1.reg}`
                    );
                } else if (operador === "<=") {
                    codigo.push(
                        `\tslt ${reg}, ${resultado2.reg}, ${resultado1.reg}`
                    );
                    codigo.push(`\txori ${reg}, ${reg}, 1`);
                } else if (operador === ">=") {
                    codigo.push(
                        `\tslt ${reg}, ${resultado1.reg}, ${resultado2.reg}`
                    );
                    codigo.push(`\txori ${reg}, ${reg}, 1`);
                } else if (operador === "==") {
                    codigo.push(
                        `\tsub ${reg}, ${resultado1.reg}, ${resultado2.reg}`
                    );
                    codigo.push(`\tsltiu ${reg}, ${reg}, 1`);
                } else if (operador === "!=") {
                    codigo.push(
                        `\tsub ${reg}, ${resultado1.reg}, ${resultado2.reg}`
                    );
                    codigo.push(`\tsltu ${reg}, zero, ${reg}`);
                }

                liberarRegistrador(resultado1.reg);
                liberarRegistrador(resultado2.reg);
            }
        }

        return { codigo, reg };
    }

    function gerarWhile(no: TreeNode) {
        if (no.nome === "while") {
            const condicao = no.filhos.find((f) => f.nome === "comparacao");
            const bloco = no.filhos.find((f) => f.nome === "bloco");

            if (condicao && bloco) {
                const inicioLabel = novoLabel();
                const fimLabel = novoLabel();

                // Label de início do loop
                codigo.push(`${inicioLabel}:`);

                // Gera a condição
                const resultadoCondicao = gerarComparacao(condicao);
                codigo.push(...resultadoCondicao.codigo);

                // Se a condição for falsa, pula para o fim
                codigo.push(`\tbeqz ${resultadoCondicao.reg}, ${fimLabel}`);
                liberarRegistrador(resultadoCondicao.reg);

                // Gera o corpo do loop
                gerarBloco(bloco);

                // Volta para o início do loop
                codigo.push(`\tj ${inicioLabel}`);

                // Label de fim do loop
                codigo.push(`${fimLabel}:`);
            }
        }
    }

    function gerarAtribuicao(no: TreeNode) {
        if (no.nome === "atribuicao") {
            const identificador = no.filhos.find((f) => f.nome === "IDENTIFIER")
                ?.filhos[0].nome;
            const expressao = no.filhos.find((f) => f.nome === "expressao");

            if (identificador && expressao) {
                const resultado = gerarExpressao(expressao);
                codigo.push(...resultado.codigo);

                const enderecoReg = novoRegistrador();
                codigo.push(
                    `\tla ${enderecoReg}, ${identificador}`,
                    `\tsw ${resultado.reg}, (${enderecoReg})`
                );
                liberarRegistrador(enderecoReg);
                liberarRegistrador(resultado.reg);
            }
        }
    }

    function gerarBloco(no: TreeNode) {
        if (no.nome === "bloco") {
            for (const filho of no.filhos) {
                if (filho.nome === "declaracao") {
                    gerarDeclaracao(filho);
                } else if (filho.nome === "while") {
                    gerarWhile(filho);
                } else if (filho.nome === "atribuicao") {
                    gerarAtribuicao(filho);
                }
            }
        }
    }

    // Primeiro gera as funções
    for (const filho of no.filhos) {
        if (
            filho.nome === "declaracao" &&
            filho.filhos[0].nome === "declaracaoFuncao"
        ) {
            gerarDeclaracao(filho);
        }
    }

    // Depois gera o código principal
    codigo.push("main:");
    // Reinicia os registradores temporários
    registradorAtual = 0;
    registradoresLivres = [];
    labelCounter = 0;

    for (const filho of no.filhos) {
        console.dir(filho, { depth: null });

        if (
            filho.nome === "declaracao" &&
            filho.filhos[0].nome === "declaracaoVariavel"
        ) {
            gerarDeclaracao(filho);
        } else if (
            filho.nome === "declaracao" &&
            filho.filhos[0].nome === "declaracaoWhile"
        ) {
            gerarDeclaracao(filho);
        } else if (
            filho.nome === "declaracao" &&
            filho.filhos[0].nome === "chamadaFuncao"
        ) {
            gerarChamadaFuncao(filho);
        }
    }

    return codigo;
}
