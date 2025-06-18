import { identificar_tokens } from "./modulos_analisador/analisador_lexico";
import { analiseSemantica } from "./modulos_analisador/analisador_semantico/analisador_semantico";
import { analiseSintatica } from "./modulos_analisador/analisador_sintatico/analisador_sintatico";
import fs from "fs";
import { gerarTAC } from "./modulos_analisador/gerador_tac";
import { gerarAssembly } from "./modulos_analisador/gerador_assembly";

const code = fs.readFileSync("input.txt", "utf-8");

try {
    // Análise léxica
    const tokenList = identificar_tokens(code);
    console.log("Análise léxica concluída com sucesso!");

    // Análise sintática
    const [sintaxeCorreta, arvore] = analiseSintatica(tokenList);

    if (sintaxeCorreta) {
        console.log(
            "Análise sintática concluída com sucesso! O código está sintaticamente correto."
        );

        fs.writeFileSync("output/arvore.json", JSON.stringify(arvore, null, 2));

        let arvoreStr = "";
        const mapping = (node: TreeNode, tab: number = 0) => {
            arvoreStr += " ".repeat(tab * 2) + node.nome + "\n";

            if (node.filhos) {
                node.filhos.forEach((filho) => mapping(filho, tab + 1));
            }
        };

        mapping(arvore[0]);

        fs.writeFileSync("output/arvore.txt", arvoreStr);

        // Análise semântica
        const [funciona, erros] = analiseSemantica(arvore);

        console.log("Análise semântica concluída com sucesso!");

        if (!funciona) {
            console.log("O código contém erros semânticos.");
            console.log(erros);
        }

        // Geração do TAC
        const tac = gerarTAC(arvore[0]);
        fs.writeFileSync("output/tac.txt", tac.join("\n"));
        console.log("TAC gerado com sucesso!");

        // Geração do Assembly
        const assembly = gerarAssembly(arvore[0]);
        fs.writeFileSync("output/assembly.txt", assembly.join("\n"));
        console.log("Assembly gerado com sucesso!");
    } else {
        console.log("O código contém erros sintáticos.");
    }
} catch (error) {
    console.error(error);
}
