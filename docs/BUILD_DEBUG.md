# Build de Debug - H5TV

Este documento descreve como gerar APKs de debug para o H5TV, incluindo o modo standalone.

## Visão Geral

O projeto oferece dois modos de build de debug:

1. **Normal**: Requer Metro bundler rodando para carregar o JavaScript
2. **Standalone**: Bundle JavaScript embutido no APK (como release)

## Scripts de Build

### Windows (PowerShell)

```powershell
# Build normal (requer Metro)
.\scripts\build-debug.ps1

# Build standalone (bundle embutido)
.\scripts\build-debug.ps1 -Standalone

# Outras opções
.\scripts\build-debug.ps1 -Help
```

### Linux/macOS (Bash)

```bash
# Build normal (requer Metro)
./scripts/build-debug.sh

# Build standalone (bundle embutido)
./scripts/build-debug.sh --standalone

# Outras opções
./scripts/build-debug.sh --help
```

## Opções Disponíveis

| Opção | PowerShell | Bash | Descrição |
|-------|------------|------|-----------|
| Clean | `-Clean` | `--clean` | Limpa builds anteriores antes de compilar |
| Skip Prebuild | `-SkipPrebuild` | `--skip-prebuild` | Pula o expo prebuild (usa android existente) |
| Skip Install | `-SkipInstall` | `--skip-install` | Apenas gera o APK, não instala no dispositivo |
| Install Only | `-InstallOnly` | `--install-only` | Instala APK existente sem rebuild |
| No Metro | `-NoMetro` | `--no-metro` | Pula inicialização do Metro |
| Standalone | `-Standalone` | `--standalone` | Gera APK com bundle JS embutido |

## Modo Standalone

O modo standalone é útil quando você precisa:

- Testar o app sem conexão com o computador de desenvolvimento
- Testar componentes nativos (como NativeStreamWebView)
- Distribuir o APK para testers
- Simular comportamento de produção

### Como Funciona

1. O script passa o parâmetro `-PbundleInDebug=true` para o Gradle
2. O `android/app/build.gradle` lê esse parâmetro e configura `debuggableVariants = []`
3. O React Native Gradle Plugin gera o bundle JavaScript durante o build
4. O bundle é incluído no APK em `assets/index.android.bundle`

### Configuração Técnica

No arquivo `android/app/build.gradle`, foi adicionado:

```gradle
react {
    // ... outras configurações ...
    
    // Enable bundling in debug builds via -PbundleInDebug=true
    if (findProperty('bundleInDebug')?.toBoolean() == true) {
        debuggableVariants = []
    }
}
```

**Por que isso é necessário?**

O React Native Gradle Plugin, por padrão, define `debuggableVariants = ["debug"]`, o que faz com que o bundle JavaScript NÃO seja gerado para builds debug. Isso é intencional para desenvolvimento, onde o Metro bundler fornece o bundle dinamicamente com hot reload.

Quando passamos `-PbundleInDebug=true`, configuramos `debuggableVariants = []`, indicando que nenhum variant é "debuggable" do ponto de vista do bundling, forçando a geração do bundle.

## Resolução de Problemas

### "Unable to load script" no modo Standalone

Se o app mostrar "Unable to load script" mesmo com `--standalone`:

1. **Verifique o build**: O script agora verifica automaticamente se o bundle foi gerado
2. **Clean build**: Tente com `-Clean` / `--clean` para limpar e rebuildar
3. **Verifique os logs**: Procure por erros durante a etapa de bundling no output do Gradle
4. **Verifique o APK**: Use um tool como APK Analyzer para verificar se `assets/index.android.bundle` existe

### Bundle não sendo gerado

Se o bundle não está sendo gerado:

1. Certifique-se de que `android/app/build.gradle` contém a configuração de `bundleInDebug`
2. Execute `npx expo prebuild` para regenerar os arquivos nativos se necessário
3. Verifique se não há erros de sintaxe no JavaScript que impeçam o bundling

### Metro não conectando (modo normal)

Se o app não conecta ao Metro no modo normal:

1. Certifique-se de que o Metro está rodando: `npx expo start`
2. Verifique a conexão reversa: `adb reverse tcp:8081 tcp:8081`
3. Verifique se o dispositivo está na mesma rede que o computador

## Estrutura do APK

### APK Normal (sem standalone)

```
app-debug.apk
├── lib/           # Bibliotecas nativas (Hermes, etc)
├── res/           # Recursos Android
├── AndroidManifest.xml
└── (sem bundle JS - carrega do Metro)
```

### APK Standalone

```
app-debug.apk
├── assets/
│   └── index.android.bundle    # Bundle JavaScript (~1-5 MB)
├── lib/           # Bibliotecas nativas
├── res/           # Recursos Android
└── AndroidManifest.xml
```

## Comandos Gradle Diretos

Se preferir executar os comandos Gradle diretamente:

```bash
cd android

# Build normal
./gradlew assembleDebug

# Build standalone (com bundle)
./gradlew assembleDebug -PbundleInDebug=true

# Clean build standalone
./gradlew clean assembleDebug -PbundleInDebug=true
```

## Diferenças entre Debug e Release

| Aspecto | Debug Normal | Debug Standalone | Release |
|---------|--------------|------------------|---------|
| Bundle JS | Metro (dinâmico) | Embutido | Embutido |
| Hot Reload | ✅ Sim | ❌ Não | ❌ Não |
| Assinatura | Debug key | Debug key | Release key |
| Minificação | ❌ Não | ❌ Não | ✅ Sim |
| Dev Tools | ✅ Habilitado | ✅ Habilitado | ❌ Desabilitado |

## Referências

- [React Native Gradle Plugin](https://reactnative.dev/docs/new-architecture-app-intro)
- [Expo Prebuild](https://docs.expo.dev/workflow/prebuild/)
- [Android Debug Bridge (ADB)](https://developer.android.com/studio/command-line/adb)