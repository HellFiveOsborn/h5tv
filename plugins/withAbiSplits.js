const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Plugin para configurar ABI splits no Android
 * Gera APKs separados por arquitetura (arm64-v8a, armeabi-v7a, x86, x86_64) + universal
 * Inclui x86/x86_64 para suporte a emuladores Android TV
 */
const withAbiSplits = (config) => {
    return withAppBuildGradle(config, (config) => {
        const buildGradle = config.modResults.contents;

        // Verificar se já foi configurado
        if (buildGradle.includes('splits {')) {
            console.log('[withAbiSplits] ABI splits já configurado');
            return config;
        }

        // Código para ler versão do package.json
        const versionCode = `
// Read version from package.json for ABI splits
def getVersionFromPackageJson() {
    def packageJsonFile = new File(rootDir.getAbsoluteFile().getParentFile(), "package.json")
    def packageJson = new groovy.json.JsonSlurper().parseText(packageJsonFile.text)
    return packageJson.version
}

def appVersion = getVersionFromPackageJson()
def versionParts = appVersion.split("\\\\.")
def versionMajor = versionParts[0].toInteger()
def versionMinor = versionParts.length > 1 ? versionParts[1].toInteger() : 0
def versionPatch = versionParts.length > 2 ? versionParts[2].toInteger() : 0
def baseVersionCode = versionMajor * 10000 + versionMinor * 100 + versionPatch

// ABI version codes offset
def abiCodes = ['armeabi-v7a': 1, 'arm64-v8a': 2, 'x86': 3, 'x86_64': 4]
`;

        // Configuração de ABI splits
        const abiSplitsConfig = `
    // Split APKs por arquitetura
    splits {
        abi {
            enable true
            reset()
            include 'armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'
            universalApk true // Gerar também APK universal
        }
    }
    
    // Gerar versionCode único por ABI
    applicationVariants.all { variant ->
        variant.outputs.each { output ->
            def abi = output.getFilter(com.android.build.OutputFile.ABI)
            if (abi != null) {
                output.versionCodeOverride = baseVersionCode * 10 + abiCodes.get(abi, 0)
            } else {
                // Universal APK
                output.versionCodeOverride = baseVersionCode * 10
            }
        }
    }
`;

        // Inserir código de versão antes do bloco android {}
        let modifiedGradle = buildGradle.replace(
            /^(android\s*\{)/m,
            versionCode + '\n$1'
        );

        // Atualizar versionCode e versionName no defaultConfig
        modifiedGradle = modifiedGradle.replace(
            /versionCode\s+\d+/,
            'versionCode baseVersionCode'
        );
        modifiedGradle = modifiedGradle.replace(
            /versionName\s+"[^"]+"/,
            'versionName appVersion'
        );

        // Adicionar ndk abiFilters no defaultConfig (antes do fechamento do defaultConfig)
        modifiedGradle = modifiedGradle.replace(
            /(defaultConfig\s*\{[\s\S]*?)(buildConfigField)/,
            `$1// Habilitar ndk abiFilters para compilação
        ndk {
            abiFilters 'armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'
        }

        $2`
        );

        // Inserir splits config após packagingOptions ou androidResources
        if (modifiedGradle.includes('androidResources {')) {
            modifiedGradle = modifiedGradle.replace(
                /(androidResources\s*\{[^}]*\})/,
                '$1\n' + abiSplitsConfig
            );
        } else if (modifiedGradle.includes('packagingOptions {')) {
            modifiedGradle = modifiedGradle.replace(
                /(packagingOptions\s*\{[\s\S]*?\}[\s\S]*?\})/,
                '$1\n' + abiSplitsConfig
            );
        } else {
            // Fallback: inserir antes do fechamento do bloco android
            modifiedGradle = modifiedGradle.replace(
                /^(\s*)(})\s*\n\s*\/\/ Apply static values/m,
                '$1' + abiSplitsConfig + '\n$1$2\n\n// Apply static values'
            );
        }

        config.modResults.contents = modifiedGradle;
        console.log('[withAbiSplits] ABI splits configurado com sucesso');

        return config;
    });
};

module.exports = withAbiSplits;