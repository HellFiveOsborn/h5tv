# Guia de Build para Releases - H5TV

Este documento descreve o processo de build para gerar APKs otimizados para publicação no GitHub Releases.

## Índice

- [Pré-requisitos](#pré-requisitos)
- [Estrutura dos APKs](#estrutura-dos-apks)
- [Scripts de Build](#scripts-de-build)
- [Processo de Release](#processo-de-release)
- [Sistema de Atualização Automática](#sistema-de-atualização-automática)
- [Troubleshooting](#troubleshooting)

## Pré-requisitos

Antes de realizar o build, certifique-se de ter:

1. **Node.js** (v18 ou superior)
2. **JDK 17** (Java Development Kit)
3. **Android SDK** com:
   - Android Build Tools
   - Android SDK Platform (API 34+)
4. **Variáveis de ambiente configuradas:**
   ```bash
   ANDROID_HOME=C:\Users\<seu-usuario>\AppData\Local\Android\Sdk
   JAVA_HOME=C:\Program Files\Java\jdk-17
   ```

## Estrutura dos APKs

O build gera três APKs com tamanhos otimizados:

| APK | Arquitetura | Tamanho Aprox. | Dispositivos |
|-----|-------------|----------------|--------------|
| `H5TV-v{version}-arm64-v8a.apk` | ARM 64-bit | ~35-40 MB | Smartphones modernos, TVs Android |
| `H5TV-v{version}-armeabi-v7a.apk` | ARM 32-bit | ~30-35 MB | Dispositivos antigos, TV boxes |
| `H5TV-v{version}-universal.apk` | Todas | ~70 MB | Qualquer dispositivo Android |

### Por que APKs separados?

- **Tamanho reduzido:** APKs específicos são ~50% menores que o universal
- **Performance:** Código nativo otimizado para a arquitetura
- **Compatibilidade:** APK universal como fallback para dispositivos não identificados

## Scripts de Build

### Windows (PowerShell)

```powershell
# Build completo (todas as arquiteturas)
npm run build:release

# Build com limpeza completa
npm run build:release:clean

# Ou diretamente:
.\scripts\build-release.ps1

# Build apenas ARM64 (dispositivos modernos)
.\scripts\build-release.ps1 -Arch arm64

# Build apenas ARM 32-bit (dispositivos antigos)
.\scripts\build-release.ps1 -Arch arm

# Build apenas Universal
.\scripts\build-release.ps1 -Arch universal

# Com múltiplos parâmetros:
.\scripts\build-release.ps1 -Clean -Arch arm64 -OutputDir ".\meus-releases"
```

### Linux/Mac (Bash)

```bash
# Dar permissão de execução (apenas uma vez)
chmod +x ./scripts/build-release.sh

# Build completo (todas as arquiteturas)
./scripts/build-release.sh

# Build apenas ARM64 (dispositivos modernos)
./scripts/build-release.sh --arch arm64

# Build apenas ARM 32-bit (dispositivos antigos)
./scripts/build-release.sh --arch arm

# Build apenas Universal
./scripts/build-release.sh --arch universal

# Com múltiplos parâmetros:
./scripts/build-release.sh --clean --arch arm64 --output ./meus-releases

# Ver ajuda
./scripts/build-release.sh --help
```

### Parâmetros Disponíveis

| Parâmetro | PowerShell | Bash | Descrição |
|-----------|------------|------|-----------|
| Arquitetura | `-Arch <arch>` | `--arch <arch>` | Arquitetura: `all`, `arm64`, `arm`, `universal` (padrão: all) |
| Limpar build | `-Clean` | `--clean` | Remove builds anteriores antes de compilar |
| Pular prebuild | `-SkipPrebuild` | `--skip-prebuild` | Usa diretório android existente |
| Diretório saída | `-OutputDir <path>` | `--output <path>` | Pasta para salvar APKs (padrão: ./releases) |
| Ajuda | - | `-h, --help` | Mostra ajuda com todas as opções |

### Valores de Arquitetura

| Valor | Descrição | Uso Recomendado |
|-------|-----------|-----------------|
| `all` | Todas as arquiteturas | Releases completas |
| `arm64` | ARM 64-bit (arm64-v8a) | Smartphones/TVs modernos |
| `arm` | ARM 32-bit (armeabi-v7a) | Dispositivos antigos, TV boxes |
| `universal` | Todas as ABIs | Compatibilidade máxima |

## Processo de Release

### 1. Atualizar Versão

Antes de gerar um release, atualize a versão no `package.json`:

```json
{
  "version": "1.3.0"
}
```

O script lerá automaticamente esta versão para nomear os APKs.

### 2. Gerar APKs

```bash
npm run build:release:clean
```

### 3. Criar Release no GitHub

1. Vá para [GitHub Releases](https://github.com/HellFiveOsborn/h5tv/releases)
2. Clique em "Draft a new release"
3. Configure a tag: `v1.3.0` (deve corresponder à versão)
4. Título: `H5TV v1.3.0`
5. Descrição: Liste as mudanças (changelog)
6. **Upload dos APKs:**
   - `H5TV-v1.3.0-arm64-v8a.apk`
   - `H5TV-v1.3.0-armeabi-v7a.apk`
   - `H5TV-v1.3.0-universal.apk`

### 4. Publicar Release

Clique em "Publish release". O app detectará automaticamente a nova versão.

## Sistema de Atualização Automática

### Como Funciona

1. **Detecção de arquitetura:** O app identifica a CPU do dispositivo (arm64-v8a, armeabi-v7a)
2. **Busca no GitHub:** Consulta a API de releases para verificar nova versão
3. **Seleção do APK:** Prioriza o APK específico, com fallback para universal
4. **Download e instalação:** Baixa o APK e abre o instalador do Android

### Nomenclatura dos APKs

O sistema de atualização espera os APKs com o seguinte padrão:

```
H5TV-v{version}-{arquitetura}.apk
```

Exemplos:
- `H5TV-v1.3.0-arm64-v8a.apk`
- `H5TV-v1.3.0-armeabi-v7a.apk`
- `H5TV-v1.3.0-universal.apk`

### Prioridade de Download

1. APK específico para a arquitetura do dispositivo (menor)
2. APK universal (maior, fallback)

## Configuração do build.gradle

O arquivo `android/app/build.gradle` está configurado para:

```gradle
// Split por arquitetura
splits {
    abi {
        enable true
        reset()
        include 'armeabi-v7a', 'arm64-v8a'
        universalApk true
    }
}

// Version codes únicos por ABI
applicationVariants.all { variant ->
    variant.outputs.each { output ->
        def abi = output.getFilter(com.android.build.OutputFile.ABI)
        if (abi != null) {
            output.versionCodeOverride = baseVersionCode * 10 + abiCodes.get(abi, 0)
        }
    }
}
```

## Troubleshooting

### Erro: "SDK location not found"

Configure a variável `ANDROID_HOME`:
```powershell
$env:ANDROID_HOME = "C:\Users\$env:USERNAME\AppData\Local\Android\Sdk"
```

### Erro: "JAVA_HOME is not set"

Configure a variável `JAVA_HOME`:
```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
```

### Build muito lento

Use a flag `--skip-prebuild` se já tiver feito prebuild recentemente:
```powershell
.\scripts\build-release.ps1 -SkipPrebuild
```

### APKs não encontrados após build

Verifique o diretório:
```
android/app/build/outputs/apk/release/
```

Se os APKs não estiverem lá, verifique os logs do Gradle para erros.

### App não detecta atualização

1. Verifique se a tag no GitHub começa com `v` (ex: `v1.3.0`)
2. Confirme que os APKs foram anexados como assets da release
3. Verifique os nomes dos APKs (devem seguir o padrão)

## Checklist de Release

- [ ] Versão atualizada no `package.json`
- [ ] Changelog documentado
- [ ] Build executado com sucesso
- [ ] APKs testados em dispositivos reais
- [ ] Release criada no GitHub com tag correta
- [ ] Todos os 3 APKs anexados como assets
- [ ] Release publicada