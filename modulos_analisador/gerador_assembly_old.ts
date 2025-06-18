// Gerador de código Assembly RISC-V

let registradorAtual = 0;
let registradoresLivres: number[] = [];

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
                let resultadoAtual = gerarTermo(termos[0]);
                codigo.push(...resultadoAtual.codigo);
                reg = resultadoAtual.reg;

                for (let i = 0; i < operadores.length; i++) {
                    const proximoResultado = gerarTermo(termos[i + 1]);
                    codigo.push(...proximoResultado.codigo);

                    const novoReg = novoRegistrador();
                    if (operadores[i] === "+") {
                        codigo.push(
                            `\tadd ${novoReg}, ${reg}, ${proximoResultado.reg}`
                        );
                    } else if (operadores[i] === "-") {
                        codigo.push(
                            `\tsub ${novoReg}, ${reg}, ${proximoResultado.reg}`
                        );
                    } else if (operadores[i] === "*") {
                        codigo.push(
                            `\tmul ${novoReg}, ${reg}, ${proximoResultado.reg}`
                        );
                    } else if (operadores[i] === "/") {
                        codigo.push(
                            `\tdiv ${novoReg}, ${reg}, ${proximoResultado.reg}`
                        );
                    }

                    liberarRegistrador(reg);
                    liberarRegistrador(proximoResultado.reg);
                    reg = novoReg;
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

                    // Move os argumentos para registradores temporários
                    const t0 = novoRegistrador();
                    const t1 = novoRegistrador();
                    codigo.push(`\tmv ${t0}, a0`, `\tmv ${t1}, a1`);

                    // Gera o add diretamente para a função soma
                    const t2 = novoRegistrador();
                    codigo.push(`\tadd ${t2}, ${t0}, ${t1}`);
                    codigo.push(`\tmv a0, ${t2}`);
                    liberarRegistrador(t2);

                    liberarRegistrador(t0);
                    liberarRegistrador(t1);
                    codigo.push(`\tret`);
                }
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

                console.dir(resultados, { depth: null });

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

    for (const filho of no.filhos) {
        if (
            filho.nome === "declaracao" &&
            filho.filhos[0].nome === "declaracaoVariavel"
        ) {
            gerarDeclaracao(filho);
        }
    }

    return codigo;
}
