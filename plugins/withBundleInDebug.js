const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Plugin para habilitar bundle JavaScript em builds debug
 * 
 * Quando executado com -PbundleInDebug=true, o React Native Gradle Plugin
 * irá gerar o bundle JavaScript mesmo em builds debug, permitindo criar
 * APKs standalone que funcionam sem o Metro bundler.
 * 
 * Uso:
 *   ./gradlew assembleDebug -PbundleInDebug=true
 * 
 * Isso é útil para:
 * - Testar componentes nativos sem Metro
 * - Criar APKs de teste para distribuição interna
 * - Debugar problemas específicos de produção
 */
const withBundleInDebug = (config) => {
    return withAppBuildGradle(config, (config) => {
        const buildGradle = config.modResults.contents;

        // Verificar se já foi configurado
        if (buildGradle.includes('bundleInDebug')) {
            console.log('[withBundleInDebug] Configuração já presente');
            return config;
        }

        // Código para adicionar dentro do bloco react {}
        // Isso configura debuggableVariants = [] quando -PbundleInDebug=true é passado
        // Uma lista vazia significa que o bundle será gerado para TODAS as variantes
        const bundleInDebugCode = `
    // Suporte para bundle em debug standalone
    // Quando -PbundleInDebug=true é passado, gera o bundle JS mesmo em debug
    if (findProperty('bundleInDebug')?.toBoolean() == true) {
        // Lista vazia = bundle é gerado para todos os variants (incluindo debug)
        debuggableVariants = []
    }
`;

        // Encontrar o final do bloco react {} e inserir antes de autolinkLibrariesWithApp()
        // O bloco react {} termina com autolinkLibrariesWithApp() seguido de }
        let modifiedGradle = buildGradle;

        // Estratégia 1: Inserir antes de autolinkLibrariesWithApp()
        if (modifiedGradle.includes('autolinkLibrariesWithApp()')) {
            modifiedGradle = modifiedGradle.replace(
                /(\s*)(autolinkLibrariesWithApp\(\))/,
                bundleInDebugCode + '$1$2'
            );
            console.log('[withBundleInDebug] Configuração adicionada antes de autolinkLibrariesWithApp()');
        }
        // Estratégia 2: Inserir após o comentário de debuggableVariants
        else if (modifiedGradle.includes('// debuggableVariants =')) {
            modifiedGradle = modifiedGradle.replace(
                /(\/\/\s*debuggableVariants\s*=.*)/,
                '$1\n' + bundleInDebugCode
            );
            console.log('[withBundleInDebug] Configuração adicionada após comentário debuggableVariants');
        }
        // Estratégia 3: Inserir dentro do bloco react {} antes do fechamento
        else {
            // Procurar pelo padrão react { ... } e inserir antes do }
            const reactBlockRegex = /(react\s*\{)([\s\S]*?)(\n\})/;
            const match = modifiedGradle.match(reactBlockRegex);

            if (match) {
                modifiedGradle = modifiedGradle.replace(
                    reactBlockRegex,
                    '$1$2' + bundleInDebugCode + '$3'
                );
                console.log('[withBundleInDebug] Configuração adicionada no final do bloco react {}');
            } else {
                console.warn('[withBundleInDebug] AVISO: Não foi possível encontrar o bloco react {}');
                console.warn('[withBundleInDebug] Adicione manualmente ao android/app/build.gradle:');
                console.warn(bundleInDebugCode);
            }
        }

        config.modResults.contents = modifiedGradle;

        return config;
    });
};

module.exports = withBundleInDebug;