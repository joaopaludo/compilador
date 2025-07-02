// Gerador de código Assembly RISC-V

let registradorAtualT = 0;
let registradoresLivresT: number[] = [];
let registradorAtualS = 0;
let registradoresLivresS: number[] = [];
let argumentoAtual = 0;
let argumentosLivres: number[] = [];
let labelCounter = 0;
let funcaoAtual: string | null = null; // Rastreia a função atual

// Mapa para rastrear parâmetros da função atual
let parametrosFuncaoAtual = new Map<string, string>();

function novoRegistrador(): string {
    if (funcaoAtual) {
        // Dentro de função: usar t
        if (registradoresLivresT.length > 0) {
            return `t${registradoresLivresT.shift()!}`;
        }
        return `t${registradorAtualT++}`;
    } else {
        // Fora de função: usar s
        if (registradoresLivresS.length > 0) {
            return `s${registradoresLivresS.shift()!}`;
        }
        return `s${registradorAtualS++}`;
    }
}

function liberarRegistrador(reg: string) {
    if (reg.startsWith("t")) {
        const num = parseInt(reg.substring(1));
        if (num >= 0) {
            registradoresLivresT.push(num);
        }
    } else if (reg.startsWith("s")) {
        const num = parseInt(reg.substring(1));
        if (num >= 0) {
            registradoresLivresS.push(num);
        }
    }
}

function novoArgumento(): string {
    if (argumentosLivres.length > 0) {
        return `a${argumentosLivres.shift()!}`;
    }
    return `a${argumentoAtual++}`;
}

function liberarArgumento(reg: string) {
    const num = parseInt(reg.substring(1));
    if (num >= 0) {
        argumentosLivres.push(num);
    }
}

function novoLabel(): string {
    const prefixo = funcaoAtual ? `${funcaoAtual}_` : "";
    return `${prefixo}label_${labelCounter++}`;
}

export function gerarAssembly(no: TreeNode): string[] {
    const codigo: string[] = [".data"];

    // Inicializa o escopo global (sem função atual)
    funcaoAtual = null;

    // Mapa para rastrear registradores associados a variáveis
    const variaveisDeclaradas = new Set<string>();
    // Novo: rastrear variáveis locais por função
    const variaveisLocaisPorFuncao = new Map<string, Set<string>>();
    let escopoFuncaoAtual: string | null = null;

    // Primeiro passo: coletar todas as variáveis e adicioná-las à seção .data
    function coletarVariaveis(
        no: TreeNode,
        escopoFuncao: string | null = null
    ) {
        if (no.nome === "declaracao") {
            const declaracao = no.filhos[0];
            if (declaracao.nome === "declaracaoFuncao") {
                const identificador = declaracao.filhos.find(
                    (f) => f.nome === "IDENTIFIER"
                )?.filhos[0].nome;
                const bloco = declaracao.filhos.find((f) => f.nome === "bloco");
                if (identificador && bloco) {
                    escopoFuncao = identificador;
                    coletarVariaveis(bloco, escopoFuncao);
                }
            } else if (declaracao.nome === "declaracaoVariavel") {
                const identificador = declaracao.filhos.find(
                    (f) => f.nome === "IDENTIFIER"
                )?.filhos[0].nome;
                if (identificador) {
                    let nomeVar = identificador;
                    if (escopoFuncao) {
                        nomeVar = `${escopoFuncao}_${identificador}`;
                        if (!variaveisLocaisPorFuncao.has(escopoFuncao)) {
                            variaveisLocaisPorFuncao.set(
                                escopoFuncao,
                                new Set()
                            );
                        }
                        variaveisLocaisPorFuncao
                            .get(escopoFuncao)!
                            .add(identificador);
                    }
                    if (!variaveisDeclaradas.has(nomeVar)) {
                        codigo.push(`${nomeVar}: .word 0`);
                        variaveisDeclaradas.add(nomeVar);
                    }
                }
            }
        }
        no.filhos.forEach((f) => coletarVariaveis(f, escopoFuncao));
    }

    coletarVariaveis(no);

    // Adicionar seção .text e jump para main
    codigo.push(".text");
    codigo.push("j main");

    function gerarExpressao(no: TreeNode): { codigo: string[]; reg: string } {
        const codigo: string[] = [];
        let reg = "";

        if (no.nome === "expressao") {
            // Separar termos e operadores
            const termos = no.filhos.filter((f) => f.nome === "termo");
            const operadores = no.filhos
                .filter((f) => f.nome === "OPERATOR")
                .map((f) => f.filhos[0].nome);

            // Se só tem um termo, retorna direto
            if (termos.length === 1) {
                const resultado = gerarTermo(termos[0]);
                codigo.push(...resultado.codigo);
                reg = resultado.reg;
            } else {
                // Agrupar multiplicação/divisão primeiro
                let fatores: { codigo: string[]; reg: string }[] = [];
                let fatoresOperadores: string[] = [];
                let i = 0;
                while (i < termos.length) {
                    // Começa com o termo atual
                    let resultado = gerarTermo(termos[i]);
                    let j = i;
                    // Enquanto o próximo operador for * ou /, agrupa
                    while (
                        j < operadores.length &&
                        (operadores[j] === "*" || operadores[j] === "/")
                    ) {
                        const prox = gerarTermo(termos[j + 1]);
                        const novoReg = novoRegistrador();
                        codigo.push(...resultado.codigo);
                        codigo.push(...prox.codigo);
                        if (operadores[j] === "*") {
                            codigo.push(
                                `\tmul ${novoReg}, ${resultado.reg}, ${prox.reg}`
                            );
                        } else {
                            codigo.push(
                                `\tdiv ${novoReg}, ${resultado.reg}, ${prox.reg}`
                            );
                        }
                        liberarRegistrador(resultado.reg);
                        liberarRegistrador(prox.reg);
                        resultado = { codigo: [], reg: novoReg };
                        j++;
                    }
                    fatores.push(resultado);
                    if (j < operadores.length)
                        fatoresOperadores.push(operadores[j]);
                    i = j + 1;
                }

                // Agora processa soma/subtração e comparações entre os fatores
                reg = fatores[0].reg;
                codigo.push(...fatores[0].codigo);
                for (let k = 0; k < fatoresOperadores.length; k++) {
                    const operador = fatoresOperadores[k];
                    const prox = fatores[k + 1];
                    codigo.push(...prox.codigo);
                    const novoReg = novoRegistrador();

                    if (operador === "+") {
                        codigo.push(`\tadd ${novoReg}, ${reg}, ${prox.reg}`);
                    } else if (operador === "-") {
                        codigo.push(`\tsub ${novoReg}, ${reg}, ${prox.reg}`);
                    } else if (operador === "<") {
                        codigo.push(`\tslt ${novoReg}, ${reg}, ${prox.reg}`);
                    } else if (operador === ">") {
                        codigo.push(`\tslt ${novoReg}, ${prox.reg}, ${reg}`);
                    } else if (operador === "<=") {
                        codigo.push(`\tslt ${novoReg}, ${prox.reg}, ${reg}`);
                        codigo.push(`\txori ${novoReg}, ${novoReg}, 1`);
                    } else if (operador === ">=") {
                        codigo.push(`\tslt ${novoReg}, ${reg}, ${prox.reg}`);
                        codigo.push(`\txori ${novoReg}, ${novoReg}, 1`);
                    } else if (operador === "==") {
                        codigo.push(`\tsub ${novoReg}, ${reg}, ${prox.reg}`);
                        codigo.push(`\tsltiu ${novoReg}, ${novoReg}, 1`);
                    } else if (operador === "!=") {
                        codigo.push(`\tsub ${novoReg}, ${reg}, ${prox.reg}`);
                        codigo.push(`\tsltu ${novoReg}, zero, ${novoReg}`);
                    } else if (operador === "and") {
                        codigo.push(`\tand ${novoReg}, ${reg}, ${prox.reg}`);
                        codigo.push(`\tsltu ${novoReg}, zero, ${novoReg}`);
                    } else if (operador === "or") {
                        codigo.push(`\tor ${novoReg}, ${reg}, ${prox.reg}`);
                        codigo.push(`\tsltu ${novoReg}, zero, ${novoReg}`);
                    }

                    liberarRegistrador(reg);
                    liberarRegistrador(prox.reg);
                    reg = novoReg;
                }
            }
        }
        return { codigo, reg };
    }

    function gerarDeclaracao(no: TreeNode) {
        if (no.nome === "declaracao") {
            no.filhos.forEach((declaracao) => {
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

                        let nomeVariavel = identificador;
                        if (
                            funcaoAtual &&
                            variaveisLocaisPorFuncao
                                .get(funcaoAtual)
                                ?.has(identificador)
                        ) {
                            nomeVariavel = `${funcaoAtual}_${identificador}`;
                        }
                        codigo.push(
                            `\tla ${enderecoReg}, ${nomeVariavel}`,
                            `\tsw ${resultado.reg}, (${enderecoReg})`
                        );
                        liberarRegistrador(enderecoReg);
                        liberarRegistrador(resultado.reg);
                    }
                } else if (declaracao.nome === "declaracaoFuncao") {
                    const identificador = declaracao.filhos.find(
                        (f) => f.nome === "IDENTIFIER"
                    )?.filhos[0].nome;
                    const bloco = declaracao.filhos.find(
                        (f) => f.nome === "bloco"
                    );

                    if (identificador) {
                        // Define a função atual para definir prefixo das labels
                        funcaoAtual = identificador;

                        codigo.push(`fun_${identificador}:`);

                        const parametros = declaracao.filhos.find(
                            (f) => f.nome === "parametros"
                        );

                        // Limpa o mapa de parâmetros da função anterior
                        parametrosFuncaoAtual.clear();

                        let parametrosRegistradores: string[] = [];
                        let parametrosArgumentos: string[] = [];
                        if (parametros) {
                            const nomesParametros = parametros.filhos
                                .filter((f) => f.nome === "IDENTIFIER")
                                .map((f) => f.filhos[0].nome);

                            parametrosRegistradores = nomesParametros.map(
                                (nomeParametro) => {
                                    const reg = novoRegistrador();
                                    const arg = novoArgumento();
                                    codigo.push(`\tmv ${reg}, ${arg}`);

                                    parametrosArgumentos.push(arg);

                                    // Mapeia o nome do parâmetro para o registrador
                                    parametrosFuncaoAtual.set(
                                        nomeParametro,
                                        reg
                                    );

                                    return reg;
                                }
                            );
                        }

                        gerarBloco(bloco!);

                        // Libera os registradores dos parâmetros
                        parametrosRegistradores.forEach((reg) => {
                            liberarRegistrador(reg);
                        });

                        parametrosArgumentos.forEach((arg) => {
                            liberarArgumento(arg);
                        });

                        // Limpa o mapa de parâmetros e a função atual ao sair da função
                        parametrosFuncaoAtual.clear();
                        funcaoAtual = null;
                    }
                } else if (declaracao.nome === "declaracaoWhile") {
                    const expressao = declaracao.filhos.find(
                        (f) => f.nome === "expressao"
                    );
                    const bloco = declaracao.filhos.find(
                        (f) => f.nome === "bloco"
                    );

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
                        codigo.push(
                            `\tbeqz ${resultadoCondicao.reg}, ${fimLabel}`
                        );
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

                    if (identificador && expressao) {
                        const resultado = gerarExpressao(expressao);
                        codigo.push(...resultado.codigo);

                        // Verifica se é um parâmetro da função atual
                        if (parametrosFuncaoAtual.has(identificador)) {
                            // Se for parâmetro, atribui diretamente ao registrador
                            const regParametro =
                                parametrosFuncaoAtual.get(identificador)!;
                            codigo.push(
                                `\tmv ${regParametro}, ${resultado.reg}`
                            );
                        } else {
                            let nomeVariavel = identificador;
                            if (
                                funcaoAtual &&
                                variaveisLocaisPorFuncao
                                    .get(funcaoAtual)
                                    ?.has(identificador)
                            ) {
                                nomeVariavel = `${funcaoAtual}_${identificador}`;
                            }
                            const enderecoReg = novoRegistrador();
                            codigo.push(
                                `\tla ${enderecoReg}, ${nomeVariavel}`,
                                `\tsw ${resultado.reg}, (${enderecoReg})`
                            );
                            liberarRegistrador(enderecoReg);
                        }
                        liberarRegistrador(resultado.reg);
                    }
                } else if (declaracao.nome === "declaracaoIf") {
                    const expressao = declaracao.filhos.find(
                        (f) => f.nome === "expressao"
                    );
                    const blocoIf = declaracao.filhos.find(
                        (f) => f.nome === "blocoIf"
                    );
                    const blocoElse = declaracao.filhos.find(
                        (f) => f.nome === "blocoElse"
                    );
                    const bloco = declaracao.filhos.find(
                        (f) => f.nome === "bloco"
                    ); // Compatibilidade

                    if (expressao && (blocoIf || bloco)) {
                        const labelFim = novoLabel();
                        const labelElse = blocoElse ? novoLabel() : labelFim;

                        // Gera a condição
                        const resultadoCondicao = gerarExpressao(expressao);
                        codigo.push(...resultadoCondicao.codigo);

                        // Se a condição for falsa (0), pula para o else ou fim
                        codigo.push(
                            `\tbeqz ${resultadoCondicao.reg}, ${labelElse}`
                        );
                        liberarRegistrador(resultadoCondicao.reg);

                        // Gera o corpo do if
                        if (blocoIf) {
                            gerarBloco(blocoIf.filhos[0]);
                        } else if (bloco) {
                            gerarBloco(bloco);
                        }

                        // Se tem else, pula para o fim após executar o if
                        if (blocoElse) {
                            codigo.push(`\tj ${labelFim}`);
                            codigo.push(`${labelElse}:`);
                            gerarBloco(blocoElse.filhos[0]);
                        }

                        // Label de fim do if/else
                        codigo.push(`${labelFim}:`);
                    }
                } else if (declaracao.nome === "declaracaoReturn") {
                    const expressao = declaracao.filhos.find(
                        (f) => f.nome === "expressao"
                    );

                    if (expressao) {
                        const resultado = gerarExpressao(expressao);
                        codigo.push(...resultado.codigo);

                        // Move o resultado para registrador de retorno
                        codigo.push(`\tmv a0, ${resultado.reg}`);
                        liberarRegistrador(resultado.reg);
                    }

                    // Retorna da função
                    codigo.push(`\tret`);
                }
            });
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

                resultados.forEach((reg) => {
                    const arg = novoArgumento();
                    codigo.push(`\tmv ${arg}, ${reg}`);

                    liberarRegistrador(reg);
                });
            }

            // Chama a função
            codigo.push(`\tcall fun_${identificador}`);

            // O resultado da função está em a0
            const reg = novoRegistrador();
            codigo.push(`\tmv ${reg}, a0`);

            // Libera o argumento a0
            liberarArgumento("a0");
            return { codigo, reg };
        }
        return { codigo: [], reg: "" };
    }

    function gerarTermo(
        no: TreeNode,
        regParametro?: string
    ): { codigo: string[]; reg: string } {
        const codigo: string[] = [];
        let reg = "";

        // Verificar se é uma negação (operador unário "no")
        if (
            no.filhos.length > 0 &&
            no.filhos[0].nome === "OPERATOR" &&
            no.filhos[0].filhos[0].nome === "no"
        ) {
            // O operador "no" deve ter exatamente dois filhos: o operador e o termo negado
            if (no.filhos.length === 2) {
                // Gera o código para o termo que está sendo negado
                const resultadoTermo = gerarTermo(no.filhos[1]);
                codigo.push(...resultadoTermo.codigo);

                // Aplica a negação: inverte o valor (0 vira 1, 1 vira 0)
                reg = novoRegistrador();
                codigo.push(`\txori ${reg}, ${resultadoTermo.reg}, 1`);

                liberarRegistrador(resultadoTermo.reg);
                return { codigo, reg };
            }
        }

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
        } else if (no.filhos[0].nome === "BOOLEAN") {
            reg = novoRegistrador();
            const valor = no.filhos[0].filhos[0].nome;
            // Converter boolean para inteiro: true = 1, false = 0
            const valorInt = valor === "true" ? 1 : 0;
            codigo.push(`\tli ${reg}, ${valorInt}`);
        } else if (no.filhos[0].nome === "IDENTIFIER") {
            const identificador = no.filhos[0].filhos[0].nome;

            // Verifica se é um parâmetro da função atual
            if (parametrosFuncaoAtual.has(identificador)) {
                const regParametro = parametrosFuncaoAtual.get(identificador)!;
                reg = novoRegistrador();
                codigo.push(`\tmv ${reg}, ${regParametro}`);
            } else {
                let nomeVariavel = identificador;
                if (
                    funcaoAtual &&
                    variaveisLocaisPorFuncao
                        .get(funcaoAtual)
                        ?.has(identificador)
                ) {
                    nomeVariavel = `${funcaoAtual}_${identificador}`;
                }
                if (variaveisDeclaradas.has(nomeVariavel)) {
                    reg = novoRegistrador();
                    const enderecoReg = novoRegistrador();
                    codigo.push(
                        `\tla ${enderecoReg}, ${nomeVariavel}`,
                        `\tlw ${reg}, (${enderecoReg})`
                    );
                    liberarRegistrador(enderecoReg);
                }
            }
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

                // Verifica se é um parâmetro da função atual
                if (parametrosFuncaoAtual.has(identificador)) {
                    // Se for parâmetro, atribui diretamente ao registrador
                    const regParametro =
                        parametrosFuncaoAtual.get(identificador)!;
                    codigo.push(`\tmv ${regParametro}, ${resultado.reg}`);
                } else {
                    // Se for variável global, carrega o endereço e faz store
                    const enderecoReg = novoRegistrador();
                    codigo.push(
                        `\tla ${enderecoReg}, ${identificador}`,
                        `\tsw ${resultado.reg}, (${enderecoReg})`
                    );
                    liberarRegistrador(enderecoReg);
                }
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
    funcaoAtual = null; // Escopo global

    codigo.push("main:");

    // Reinicia os registradores temporários
    registradorAtualT = 0;
    registradoresLivresT = [];
    registradorAtualS = 0;
    registradoresLivresS = [];
    labelCounter = 0;

    for (const filho of no.filhos) {
        if (
            filho.nome === "declaracao" &&
            filho.filhos[0].nome === "chamadaFuncao"
        ) {
            gerarChamadaFuncao(filho);
        } else if (
            filho.nome === "declaracao" &&
            filho.filhos[0].nome !== "declaracaoFuncao"
        ) {
            gerarDeclaracao(filho);
        }
    }

    return codigo;
}
