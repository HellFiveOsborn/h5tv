#!/bin/bash
# build-release.sh - Script de Build para Produção H5TV
# Gera APKs otimizados por arquitetura para releases no GitHub

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Parâmetros
CLEAN=false
SKIP_PREBUILD=false
OUTPUT_DIR="./releases"
ARCH="all"  # all, arm64, arm, universal

# Parse argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        --clean)
            CLEAN=true
            shift
            ;;
        --skip-prebuild)
            SKIP_PREBUILD=true
            shift
            ;;
        --output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --arch)
            ARCH="$2"
            if [[ ! "$ARCH" =~ ^(all|arm64|arm|universal)$ ]]; then
                echo "Arquitetura invalida: $ARCH"
                echo "Valores validos: all, arm64, arm, universal"
                exit 1
            fi
            shift 2
            ;;
        -h|--help)
            echo "Uso: $0 [opcoes]"
            echo ""
            echo "Opcoes:"
            echo "  --clean           Limpa builds anteriores"
            echo "  --skip-prebuild   Pula o expo prebuild"
            echo "  --output <dir>    Diretorio de saida (padrao: ./releases)"
            echo "  --arch <arch>     Arquitetura: all, arm64, arm, universal (padrao: all)"
            echo "  -h, --help        Mostra esta ajuda"
            exit 0
            ;;
        *)
            echo "Opcao desconhecida: $1"
            echo "Use --help para ver as opcoes disponiveis"
            exit 1
            ;;
    esac
done

log_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Banner
echo ""
echo -e "${MAGENTA}========================================"
echo "       H5TV Release Build Script       "
echo -e "========================================${NC}"
echo ""

if [ "$ARCH" != "all" ]; then
    log_info "Arquitetura selecionada: $ARCH"
fi

# Verificar se estamos no diretório correto
if [ ! -f "./package.json" ]; then
    log_error "Arquivo package.json nao encontrado. Execute este script na raiz do projeto."
    exit 1
fi

# Ler versão do package.json
VERSION=$(node -p "require('./package.json').version")
log_info "Versao detectada: v$VERSION"

# Verificar se o diretório android existe
if [ ! -d "./android" ]; then
    log_warning "Diretorio android nao encontrado. Executando prebuild..."
    SKIP_PREBUILD=false
fi

# Executar prebuild se necessário
if [ "$SKIP_PREBUILD" = false ]; then
    log_info "Executando expo prebuild..."
    if [ "$CLEAN" = true ]; then
        npx expo prebuild --clean
    else
        npx expo prebuild
    fi
    log_success "Prebuild concluido"
fi

# Criar diretório de output se não existir
mkdir -p "$OUTPUT_DIR"
log_info "Diretorio de output: $OUTPUT_DIR"

# Navegar para o diretório android
cd android

# Limpar builds anteriores se solicitado
if [ "$CLEAN" = true ]; then
    log_info "Limpando builds anteriores..."
    ./gradlew clean
    log_success "Build limpo"
fi

# Build Release
log_info "Iniciando build de release..."
log_info "Isso pode levar alguns minutos..."

# Sempre usa assembleRelease - o split por ABI é configurado no build.gradle
# O Gradle gerará todos os APKs configurados no splits.abi
BUILD_TASK="assembleRelease"

log_info "Executando task: $BUILD_TASK"
log_info "APKs serao filtrados apos o build baseado na arquitetura: $ARCH"
./gradlew $BUILD_TASK --no-daemon

log_success "Build concluido com sucesso!"

# Voltar para o diretório raiz
cd ..

# Copiar e renomear APKs
APK_DIR="./android/app/build/outputs/apk/release"

if [ ! -d "$APK_DIR" ]; then
    log_error "Diretorio de APKs nao encontrado: $APK_DIR"
    exit 1
fi

log_info "Processando APKs gerados..."

# Array de mapeamentos: source -> "dest_name|arch"
declare -A APK_MAPPINGS
APK_MAPPINGS["app-arm64-v8a-release.apk"]="H5TV-v${VERSION}-arm64-v8a.apk|arm64"
APK_MAPPINGS["app-armeabi-v7a-release.apk"]="H5TV-v${VERSION}-armeabi-v7a.apk|arm"
APK_MAPPINGS["app-universal-release.apk"]="H5TV-v${VERSION}-universal.apk|universal"
APK_MAPPINGS["app-release.apk"]="H5TV-v${VERSION}-universal.apk|universal"  # Fallback se não houver splits

COPIED_FILES=()

for source_name in "${!APK_MAPPINGS[@]}"; do
    IFS='|' read -r dest_name apk_arch <<< "${APK_MAPPINGS[$source_name]}"
    
    # Filtrar por arquitetura se especificada
    if [ "$ARCH" != "all" ] && [ "$apk_arch" != "$ARCH" ]; then
        continue
    fi
    
    source_file="$APK_DIR/$source_name"
    dest_file="$OUTPUT_DIR/$dest_name"
    
    if [ -f "$source_file" ]; then
        cp "$source_file" "$dest_file"
        file_size=$(du -m "$dest_file" | cut -f1)
        COPIED_FILES+=("$dest_name ($file_size MB)")
        log_success "Copiado: $dest_name ($file_size MB)"
    else
        if [ "$ARCH" = "all" ] || [ "$apk_arch" = "$ARCH" ]; then
            log_warning "Arquivo nao encontrado: $source_name"
        fi
    fi
done

# Resumo final
echo ""
echo -e "${GREEN}========================================"
echo "         BUILD CONCLUIDO!              "
echo -e "========================================${NC}"
echo ""

log_info "Versao: v$VERSION"
log_info "APKs gerados em: $OUTPUT_DIR"
echo ""

echo -e "${CYAN}Arquivos prontos para release:${NC}"
for file in "${COPIED_FILES[@]}"; do
    echo "  - $file"
done

echo ""
echo -e "${YELLOW}Proximos passos:${NC}"
echo "  1. Testar os APKs em dispositivos reais"
echo "  2. Criar uma nova release no GitHub"
echo "  3. Fazer upload dos APKs como assets da release"
echo "  4. Marcar a release com a tag v$VERSION"
echo ""

# Listar arquivos gerados
log_info "Listando arquivos gerados:"
ls -lh "$OUTPUT_DIR"/*.apk 2>/dev/null || log_warning "Nenhum APK encontrado"