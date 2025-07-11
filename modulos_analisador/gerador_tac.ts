let contadorTemp = 0;
let contadorLabel = 1;
let tempLivres: string[] = [];

function novoTemp(): string {
    if (tempLivres.length > 0) {
        return tempLivres.shift()!;
    }
    return `t${contadorTemp++}`;
}

function liberarTemp(temp: string) {
    if (temp.startsWith("t")) {
        tempLivres.push(temp);
    }
}

function novoLabel(): string {
    return `L${contadorLabel++}`;
}

export function gerarTAC(no: TreeNode): string[] {
    const codigo: string[] = [];

    function gerarExpressao(no: TreeNode): { codigo: string[]; temp: string } {
        const codigo: string[] = [];
        let temp = "";

        if (no.nome === "expressao") {
            // Primeiro, processa todas as subexpressões em parênteses
            const subexpressoes = no.filhos.filter(
                (f) => f.nome === "expressao"
            );
            const resultadosSubexpressoes = new Map<
                number,
                { codigo: string[]; temp: string }
            >();

            subexpressoes.forEach((subexp, index) => {
                const resultado = gerarExpressao(subexp);
                resultadosSubexpressoes.set(index, resultado);
            });

            // Agora processa os operadores e termos normalmente
            const operadores = no.filhos
                .filter((f) => f.nome === "OPERATOR")
                .map((f) => f.filhos[0].nome);
            const termos = no.filhos.filter(
                (f) => f.nome === "termo" || f.nome === "expressao"
            );

            if (termos.length === 1) {
                if (termos[0].nome === "expressao") {
                    const resultado = resultadosSubexpressoes.get(0)!;
                    codigo.push(...resultado.codigo);
                    temp = resultado.temp;
                } else {
                    const resultado = gerarTermo(termos[0]);
                    codigo.push(...resultado.codigo);
                    temp = resultado.temp;
                }
            } else {
                // Primeiro processa multiplicação e divisão
                let i = 0;
                while (i < operadores.length) {
                    if (operadores[i] === "*" || operadores[i] === "/") {
                        let resultadoAtual;
                        if (termos[i].nome === "expressao") {
                            resultadoAtual = resultadosSubexpressoes.get(i)!;
                            codigo.push(...resultadoAtual.codigo);
                        } else {
                            resultadoAtual = gerarTermo(termos[i]);
                            codigo.push(...resultadoAtual.codigo);
                        }

                        let proximoResultado;
                        if (termos[i + 1].nome === "expressao") {
                            proximoResultado = resultadosSubexpressoes.get(
                                i + 1
                            )!;
                            codigo.push(...proximoResultado.codigo);
                        } else {
                            proximoResultado = gerarTermo(termos[i + 1]);
                            codigo.push(...proximoResultado.codigo);
                        }

                        const novoTempVar = novoTemp();
                        codigo.push(
                            `${novoTempVar} = ${resultadoAtual.temp} ${operadores[i]} ${proximoResultado.temp}`
                        );

                        liberarTemp(resultadoAtual.temp);
                        liberarTemp(proximoResultado.temp);

                        // Atualiza os termos e operadores
                        termos.splice(i, 2, {
                            nome: "termo",
                            filhos: [
                                {
                                    nome: "TEMP",
                                    filhos: [
                                        {
                                            nome: novoTempVar,
                                            ordem: 0,
                                            filhos: [],
                                        },
                                    ],
                                    ordem: 0,
                                },
                            ],
                            ordem: 0,
                        });
                        operadores.splice(i, 1);
                    } else {
                        i++;
                    }
                }

                // Depois processa soma e subtração
                let resultadoAtual;
                if (termos[0].nome === "expressao") {
                    resultadoAtual = resultadosSubexpressoes.get(0)!;
                    codigo.push(...resultadoAtual.codigo);
                } else {
                    resultadoAtual = gerarTermo(termos[0]);
                    codigo.push(...resultadoAtual.codigo);
                }
                temp = resultadoAtual.temp;

                for (let i = 0; i < operadores.length; i++) {
                    let proximoResultado;
                    if (termos[i + 1].nome === "expressao") {
                        proximoResultado = resultadosSubexpressoes.get(i + 1)!;
                        codigo.push(...proximoResultado.codigo);
                    } else {
                        proximoResultado = gerarTermo(termos[i + 1]);
                        codigo.push(...proximoResultado.codigo);
                    }

                    const novoTempVar = novoTemp();
                    codigo.push(
                        `${novoTempVar} = ${temp} ${operadores[i]} ${proximoResultado.temp}`
                    );

                    liberarTemp(temp);
                    liberarTemp(proximoResultado.temp);

                    temp = novoTempVar;
                }
            }
        }

        return { codigo, temp };
    }

    function gerarTermo(no: TreeNode): { codigo: string[]; temp: string } {
        const codigo: string[] = [];
        let temp = "";

        // Verifica se o termo contém uma expressão (parênteses)
        const subexpressao = no.filhos.find((f) => f.nome === "expressao");
        if (subexpressao) {
            const resultado = gerarExpressao(subexpressao);
            codigo.push(...resultado.codigo);
            temp = resultado.temp;
            return { codigo, temp };
        }

        // Verifica se é uma chamada de função
        const chamadaFuncao = no.filhos.find((f) => f.nome === "chamadaFuncao");
        if (chamadaFuncao) {
            const identificador = chamadaFuncao.filhos.find(
                (f) => f.nome === "IDENTIFIER"
            )?.filhos[0].nome;
            const argumentos = chamadaFuncao.filhos.find(
                (f) => f.nome === "argumentos"
            );

            if (identificador) {
                // Processa os argumentos
                if (argumentos) {
                    for (const arg of argumentos.filhos) {
                        const resultado = gerarExpressao(arg);
                        codigo.push(...resultado.codigo);
                        codigo.push(`param ${resultado.temp}`);
                        liberarTemp(resultado.temp);
                    }
                }

                temp = novoTemp();
                codigo.push(`${temp} = call ${identificador}`);
            }
            return { codigo, temp };
        }

        // Processamento normal para termos simples
        if (
            no.filhos[0].nome === "INTEGER" ||
            no.filhos[0].nome === "STRING" ||
            no.filhos[0].nome === "BOOLEAN"
        ) {
            temp = novoTemp();
            codigo.push(`${temp} = ${no.filhos[0].filhos[0].nome}`);
        } else if (no.filhos[0].nome === "IDENTIFIER") {
            temp = novoTemp();
            codigo.push(`${temp} = ${no.filhos[0].filhos[0].nome}`);
        } else if (no.filhos[0].nome === "TEMP") {
            temp = no.filhos[0].filhos[0].nome;
        }

        return { codigo, temp };
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

                if (expressao) {
                    const resultado = gerarExpressao(expressao);
                    codigo.push(...resultado.codigo);
                    codigo.push(`${identificador} = ${resultado.temp}`);
                    liberarTemp(resultado.temp);
                }
            } else if (declaracao.nome === "declaracaoFuncao") {
                const identificador = declaracao.filhos.find(
                    (f) => f.nome === "IDENTIFIER"
                )?.filhos[0].nome;
                const parametros = declaracao.filhos.find(
                    (f) => f.nome === "parametros"
                );
                const bloco = declaracao.filhos.find((f) => f.nome === "bloco");

                if (identificador) {
                    codigo.push(`function ${identificador}:`);

                    // Processa os parâmetros
                    if (parametros) {
                        for (const param of parametros.filhos) {
                            const paramId = param.filhos.find(
                                (f) => f.nome === "IDENTIFIER"
                            )?.filhos[0].nome;
                            if (paramId) {
                                codigo.push(`param ${paramId}`);
                            }
                        }
                    }

                    // Processa o bloco da função
                    if (bloco) {
                        for (const filho of bloco.filhos) {
                            gerarDeclaracao(filho);
                        }
                    }
                }
            } else if (declaracao.nome === "declaracaoIf") {
                const expressao = declaracao.filhos.find(
                    (f) => f.nome === "expressao"
                );
                const bloco = declaracao.filhos.find((f) => f.nome === "bloco");

                if (expressao) {
                    const resultado = gerarExpressao(expressao);
                    codigo.push(...resultado.codigo);
                    const labelFim = novoLabel();
                    codigo.push(`ifFalse ${resultado.temp} goto ${labelFim}`);
                    liberarTemp(resultado.temp);

                    if (bloco) {
                        for (const filho of bloco.filhos) {
                            gerarDeclaracao(filho);
                        }
                    }

                    codigo.push(`${labelFim}:`);
                }
            } else if (declaracao.nome === "declaracaoWhile") {
                const expressao = declaracao.filhos.find(
                    (f) => f.nome === "expressao"
                );
                const bloco = declaracao.filhos.find((f) => f.nome === "bloco");

                if (expressao) {
                    const labelInicio = novoLabel();
                    const labelFim = novoLabel();

                    codigo.push(`${labelInicio}:`);
                    const resultado = gerarExpressao(expressao);
                    codigo.push(...resultado.codigo);
                    codigo.push(`ifFalse ${resultado.temp} goto ${labelFim}`);
                    liberarTemp(resultado.temp);

                    if (bloco) {
                        for (const filho of bloco.filhos) {
                            gerarDeclaracao(filho);
                        }
                    }

                    codigo.push(`goto ${labelInicio}`);
                    codigo.push(`${labelFim}:`);
                }
            } else if (declaracao.nome === "atribuicao") {
                const identificador = declaracao.filhos.find(
                    (f) => f.nome === "IDENTIFIER"
                )?.filhos[0].nome;
                const expressao = declaracao.filhos.find(
                    (f) => f.nome === "expressao"
                );

                if (expressao && identificador) {
                    const resultado = gerarExpressao(expressao);
                    codigo.push(...resultado.codigo);
                    codigo.push(`${identificador} = ${resultado.temp}`);
                    liberarTemp(resultado.temp);
                }
            }
        }
    }

    for (const filho of no.filhos) {
        gerarDeclaracao(filho);
    }

    return codigo;
}
