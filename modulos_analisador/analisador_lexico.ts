/**
 * Objeto com as expressões regulares para cada tipo de token a
 * ser identificado no código fonte recebido como entrada
 */
const tokenRegex = {
    KEYWORD: /\b(if|else|while|return|function)\b/,
    TYPE: /\b(int|string|boolean)\b/,
    BOOLEAN: /\b(true|false)\b/,
    OPERATOR: /!=|==|<=|>=|[+\-=*></]|and|or/,
    IDENTIFIER: /[a-zA-Z_][a-zA-Z0-9_]*/,
    INTEGER: /\b\d+\b/,
    STRING: /"[^"]*"/,
    SYMBOL: /[;(){},]/,
    WHITESPACE: /\s+/,
    INVALID: /[^a-zA-Z0-9_+\-*/;(){}\s"]/,
} satisfies Record<string, RegExp>;

/**
 * Função que divide e identifica os tokens do código fonte
 *
 * @param codigo codigo fonte da linguagem fictícia similar ao JavaScript
 * @returns conjunto dos tokens conforme foram divididos e identificados
 */
export function identificar_tokens(codigo: string): Token[] {
    const tokens: Token[] = [];
    let posicao = 0;
    let linha = 1; // Começamos na linha 1
    let coluna = 1; // Começamos na coluna 1

    while (posicao < codigo.length) {
        let houveMatch = false;

        for (const [tipo, regex] of Object.entries(tokenRegex)) {
            const match = codigo.slice(posicao).match(regex);
            if (match && match.index === 0) {
                const tokenValue = match[0];

                if (tipo !== "WHITESPACE") {
                    if (tipo === "INVALID") {
                        // Erro lançado ao encontrar algum caractere que não está incluso nas expressões
                        // regulares que definem o que pode compor os tokens da linguagem
                        throw new Error(
                            `Caractere inválido encontrado: ${tokenValue} na linha ${linha}, coluna ${coluna}`
                        );
                    }
                    tokens.push({
                        tipo: tipo,
                        valor: tokenValue,
                        linha: linha,
                        coluna: coluna,
                    });
                }

                // Atualiza a posição, linha e coluna
                if (tipo === "WHITESPACE") {
                    // Conta quebras de linha no espaço em branco
                    const newlines = tokenValue.match(/\n/g);
                    if (newlines) {
                        linha += newlines.length;
                        // Calcula a nova coluna após a última quebra de linha
                        const lastNewlineIndex = tokenValue.lastIndexOf("\n");
                        if (lastNewlineIndex !== -1) {
                            coluna = tokenValue.length - lastNewlineIndex;
                        } else {
                            coluna += tokenValue.length;
                        }
                    } else {
                        coluna += tokenValue.length;
                    }
                } else {
                    // Para tokens que não são espaço em branco, apenas avançamos a coluna
                    coluna += tokenValue.length;
                }

                posicao += tokenValue.length;
                houveMatch = true;
                break;
            }
        }

        if (!houveMatch) {
            // Erro lançado ao encontrar algum erro léxico, ou seja, quando identifica algum
            // token no código que não dá match com nenhuma das expressões regulares definidas
            throw new Error(
                `Erro léxico próximo a: ${codigo.slice(
                    posicao,
                    posicao + 10
                )} na linha ${linha}, coluna ${coluna}`
            );
        }
    }
    return tokens;
}
