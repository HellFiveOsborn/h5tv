#!/bin/bash
# build-debug.sh - Script de Build Debug para H5TV
# Gera APK debug, instala no dispositivo e mostra logs em tempo real

set -e

# Package name do app (definido no app.json)
PACKAGE_NAME="com.hellfiveosborn.H5TV"
MAIN_ACTIVITY="$PACKAGE_NAME.MainActivity"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Parâmetros
CLEAN=false
SKIP_PREBUILD=false
SKIP_INSTALL=false
INSTALL_ONLY=false
NO_METRO=false
STANDALONE=false

# Funções de log
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

log_debug() {
    echo -e "${MAGENTA}[DEBUG]${NC} $1"
}

# Função de ajuda
show_help() {
    echo ""
    echo -e "${CYAN}========================================"
    echo "       H5TV Debug Build Script         "
    echo -e "========================================${NC}"
    echo ""
    echo -e "Uso: $0 [opcoes]"
    echo ""
    echo -e "${YELLOW}Opcoes:${NC}"
    echo "  --clean           Limpa builds anteriores antes de compilar"
    echo "  --skip-prebuild   Pula o expo prebuild (usa android existente)"
    echo "  --skip-install    Apenas gera o APK, nao instala no dispositivo"
    echo "  --install-only    Instala APK existente sem rebuild (pula prebuild e build)"
    echo "  --no-metro        Pula inicializacao do Metro (use se ja estiver rodando)"
    echo "  --standalone      Gera APK com bundle JS embutido (nao precisa do Metro)"
    echo "  -h, --help        Mostra esta mensagem de ajuda"
    echo ""
    echo -e "${YELLOW}Exemplos:${NC}"
    echo "  $0                      # Build completo com instalacao e logs"
    echo "  $0 --clean              # Build limpo"
    echo "  $0 --skip-prebuild      # Pula prebuild (mais rapido)"
    echo "  $0 --skip-install       # Apenas gera APK"
    echo "  $0 --install-only       # Instala APK existente sem rebuild"
    echo "  $0 --no-metro           # Nao inicia o Metro (ja rodando)"
    echo "  $0 --standalone         # APK standalone (bundle embutido)"
    echo ""
    echo -e "${CYAN}Modos de Build:${NC}"
    echo -e "  ${NC}Normal (sem --standalone):${NC}"
    echo "    - Requer Metro bundler rodando para carregar o JavaScript"
    echo "    - Ideal para desenvolvimento (hot reload, fast refresh)"
    echo "    - O app conecta ao Metro na porta 8081"
    echo ""
    echo -e "  ${NC}Standalone (--standalone):${NC}"
    echo "    - Bundle JavaScript embutido no APK (como release)"
    echo "    - NAO precisa do Metro bundler"
    echo "    - Ideal para testar componentes nativos (ex: NativeStreamWebView)"
    echo "    - Funciona offline, igual ao APK de producao"
    echo ""
    echo -e "${CYAN}O script ira:${NC}"
    echo "  1. Executar expo prebuild (se necessario)"
    echo "  2. Gerar bundle JS (apenas com --standalone)"
    echo "  3. Gerar APK em modo debug"
    echo "  4. Instalar o APK no dispositivo conectado via ADB"
    echo "  5. Configurar conexao reversa (apenas sem --standalone)"
    echo "  6. Iniciar o Metro bundler (apenas sem --standalone)"
    echo "  7. Iniciar o app automaticamente"
    echo "  8. Abrir o logcat filtrado para logs do React Native"
    echo ""
    echo -e "${YELLOW}Pressione Ctrl+C para encerrar o logcat${NC}"
    echo ""
}

# Função para configurar adb reverse
setup_adb_reverse() {
    log_info "Configurando conexao reversa (adb reverse tcp:8081 tcp:8081)..."
    if adb reverse tcp:8081 tcp:8081 2>/dev/null; then
        log_success "Conexao reversa configurada - dispositivo pode acessar Metro na porta 8081"
    else
        log_warning "Falha ao configurar conexao reversa - o app pode nao conseguir carregar o bundle"
    fi
}

# Função para iniciar o Metro bundler
start_metro_bundler() {
    log_info "Iniciando Metro bundler em background..."
    
    # Detectar se estamos em um terminal gráfico e abrir nova janela
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal -- bash -c "cd '$(pwd)'; echo -e '${CYAN}Metro Bundler - H5TV Debug${NC}'; echo ''; npx expo start; exec bash"
        log_success "Metro bundler iniciado em nova janela (gnome-terminal)"
    elif command -v xterm &> /dev/null; then
        xterm -e "cd '$(pwd)'; echo 'Metro Bundler - H5TV Debug'; npx expo start; bash" &
        log_success "Metro bundler iniciado em nova janela (xterm)"
    elif command -v osascript &> /dev/null; then
        # macOS - abrir novo terminal
        osascript -e "tell application \"Terminal\" to do script \"cd '$(pwd)'; echo 'Metro Bundler - H5TV Debug'; npx expo start\""
        log_success "Metro bundler iniciado em nova janela (Terminal.app)"
    else
        # Fallback: rodar em background
        log_warning "Nenhum terminal grafico detectado, iniciando Metro em background..."
        npx expo start &
        METRO_PID=$!
        log_success "Metro bundler iniciado em background (PID: $METRO_PID)"
    fi
    
    echo ""
    log_info "Aguardando Metro inicializar (5 segundos)..."
    sleep 5
    echo ""
    echo -e "${YELLOW}----------------------------------------${NC}"
    echo -e "${YELLOW}  DICA: Se o app mostrar 'Unable to load script',${NC}"
    echo -e "${YELLOW}  pressione 'r' na janela do Metro para reload${NC}"
    echo -e "${YELLOW}----------------------------------------${NC}"
    echo ""
}

# Função para limpar bundle anterior (para builds normais)
clean_js_bundle() {
    local bundle_path="./android/app/src/main/assets/index.android.bundle"
    if [ -f "$bundle_path" ]; then
        rm -f "$bundle_path"
        log_debug "Bundle anterior removido"
    fi
}

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
        --skip-install)
            SKIP_INSTALL=true
            shift
            ;;
        --install-only)
            INSTALL_ONLY=true
            shift
            ;;
        --no-metro)
            NO_METRO=true
            shift
            ;;
        --standalone)
            STANDALONE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Opcao desconhecida: $1"
            echo "Use --help para ver as opcoes disponiveis"
            exit 1
            ;;
    esac
done

# Função para configurar JAVA_HOME
set_java_home() {
    local required_version=17
    local current_version=0
    
    # Verificar versão atual do Java
    if command -v java &> /dev/null; then
        current_version=$(java -version 2>&1 | head -n1 | cut -d'"' -f2 | cut -d'.' -f1)
        # Para Java 8, o formato é "1.8.x"
        if [ "$current_version" = "1" ]; then
            current_version=$(java -version 2>&1 | head -n1 | cut -d'"' -f2 | cut -d'.' -f2)
        fi
    fi
    
    if [ "$current_version" -ge "$required_version" ] 2>/dev/null; then
        log_info "Java $current_version detectado - OK"
        return 0
    fi
    
    log_warning "Java atual ($current_version) e inferior a $required_version"
    
    # Procurar por instalações de Java 17+ (Linux/Mac)
    local java_paths=(
        "/usr/lib/jvm/java-17-openjdk"
        "/usr/lib/jvm/java-21-openjdk"
        "/usr/lib/jvm/temurin-17-jdk"
        "/usr/lib/jvm/temurin-21-jdk"
        "/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home"
        "/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home"
        "/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home"
        "/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home"
    )
    
    for java_path in "${java_paths[@]}"; do
        if [ -x "$java_path/bin/java" ]; then
            log_info "Encontrado Java em: $java_path"
            export JAVA_HOME="$java_path"
            export PATH="$JAVA_HOME/bin:$PATH"
            log_success "JAVA_HOME configurado para: $java_path"
            return 0
        fi
    done
    
    log_error "Java 17 ou superior nao encontrado. Instale o JDK 17 de: https://adoptium.net/"
    return 1
}

# Função para verificar dispositivo ADB
check_adb_device() {
    if ! command -v adb &> /dev/null; then
        log_error "ADB nao encontrado. Verifique se o Android SDK esta instalado e no PATH"
        return 1
    fi
    
    local devices=$(adb devices 2>&1 | grep -E "device$" | wc -l)
    if [ "$devices" -gt 0 ]; then
        log_success "$devices dispositivo(s) conectado(s)"
        return 0
    else
        log_warning "Nenhum dispositivo conectado via ADB"
        return 1
    fi
}

# Obter a ABI/arquitetura do dispositivo conectado
get_device_abi() {
    local abi=$(adb shell getprop ro.product.cpu.abi 2>/dev/null | tr -d '\r\n')
    if [ -n "$abi" ] && [[ ! "$abi" =~ "error" ]]; then
        echo "$abi"
        return 0
    fi
    return 1
}

# Obter lista de ABIs suportadas pelo dispositivo
get_device_abi_list() {
    local abi_list=$(adb shell getprop ro.product.cpu.abilist 2>/dev/null | tr -d '\r\n')
    if [ -n "$abi_list" ] && [[ ! "$abi_list" =~ "error" ]]; then
        echo "$abi_list"
        return 0
    fi
    return 1
}

# Mostrar informações do dispositivo conectado
show_device_info() {
    local device_line=$(adb devices -l 2>&1 | grep -E "device " | head -n1)
    
    if [ -n "$device_line" ]; then
        local model=$(echo "$device_line" | grep -oP 'model:\K\S+' || echo "")
        local device=$(echo "$device_line" | grep -oP 'device:\K\S+' || echo "")
        local transport_id=$(echo "$device_line" | grep -oP 'transport_id:\K\S+' || echo "")
        
        # Obter ABI do dispositivo
        local abi=$(get_device_abi)
        local abi_list=$(get_device_abi_list)
        
        echo ""
        log_info "Dispositivo detectado:"
        if [ -n "$model" ]; then
            echo -e "       Modelo: ${NC}$model"
        fi
        if [ -n "$device" ]; then
            echo -e "       Device: ${NC}$device"
        fi
        if [ -n "$abi" ]; then
            echo -e "       ABI: ${YELLOW}$abi${NC}"
        fi
        if [ -n "$abi_list" ] && [[ "$abi_list" == *","* ]]; then
            echo -e "       ABIs suportadas: ${GRAY}$abi_list${NC}"
        fi
        if [ -n "$transport_id" ]; then
            echo -e "       Transport ID: ${NC}$transport_id"
        fi
        echo ""
    fi
}

# Mapear ABI para nome do APK
get_apk_name_for_abi() {
    local abi="$1"
    case "$abi" in
        "arm64-v8a") echo "app-arm64-v8a-debug.apk" ;;
        "armeabi-v7a") echo "app-armeabi-v7a-debug.apk" ;;
        "x86") echo "app-x86-debug.apk" ;;
        "x86_64") echo "app-x86_64-debug.apk" ;;
        *) echo "" ;;
    esac
}

# Variáveis globais para resultado da busca de APK
APK_FALLBACK=false
APK_TARGET_ABI=""

# Localizar APK de debug compatível com o dispositivo
find_debug_apk() {
    local device_abi="$1"
    local apk_dir="./android/app/build/outputs/apk/debug"
    
    APK_FALLBACK=false
    APK_TARGET_ABI=""
    
    # Se temos a ABI do dispositivo, tentar encontrar APK específico
    if [ -n "$device_abi" ]; then
        local specific_apk=$(get_apk_name_for_abi "$device_abi")
        if [ -n "$specific_apk" ] && [ -f "$apk_dir/$specific_apk" ]; then
            log_success "APK especifico encontrado para arquitetura $device_abi"
            APK_TARGET_ABI="$device_abi"
            echo "$apk_dir/$specific_apk"
            return 0
        fi
        
        if [ -n "$specific_apk" ]; then
            log_warning "APK especifico para $device_abi nao encontrado: $specific_apk"
        fi
        
        # Tentar ABIs compatíveis (ex: arm64-v8a pode rodar armeabi-v7a)
        local compat_abis=""
        case "$device_abi" in
            "arm64-v8a") compat_abis="armeabi-v7a" ;;
            "x86_64") compat_abis="x86" ;;
        esac
        
        for compat_abi in $compat_abis; do
            local compat_apk=$(get_apk_name_for_abi "$compat_abi")
            if [ -n "$compat_apk" ] && [ -f "$apk_dir/$compat_apk" ]; then
                log_warning "Usando APK compativel ($compat_abi) para dispositivo $device_abi"
                APK_FALLBACK=true
                APK_TARGET_ABI="$compat_abi"
                echo "$apk_dir/$compat_apk"
                return 0
            fi
        done
    fi
    
    # Fallback: tentar APK universal ou genérico
    for fallback_apk in "app-universal-debug.apk" "app-debug.apk"; do
        if [ -f "$apk_dir/$fallback_apk" ]; then
            if [ -n "$device_abi" ]; then
                log_warning "Usando APK fallback: $fallback_apk (dispositivo requer $device_abi)"
            fi
            APK_FALLBACK=true
            APK_TARGET_ABI="universal"
            echo "$apk_dir/$fallback_apk"
            return 0
        fi
    done
    
    # Último recurso: qualquer APK disponível
    for any_apk in "app-arm64-v8a-debug.apk" "app-armeabi-v7a-debug.apk" "app-x86-debug.apk" "app-x86_64-debug.apk"; do
        if [ -f "$apk_dir/$any_apk" ]; then
            log_warning "ATENCAO: Usando APK $any_apk que pode NAO ser compativel com o dispositivo ($device_abi)"
            APK_FALLBACK=true
            APK_TARGET_ABI=$(echo "$any_apk" | sed 's/app-//' | sed 's/-debug\.apk//')
            echo "$apk_dir/$any_apk"
            return 0
        fi
    done
    
    return 1
}

# Mostrar erro detalhado quando APK não é encontrado
show_apk_not_found_error() {
    local device_abi="$1"
    local apk_dir="./android/app/build/outputs/apk/debug"
    
    log_error "Nenhum APK compativel encontrado!"
    echo ""
    echo -e "       Arquitetura do dispositivo: ${YELLOW}$device_abi${NC}"
    echo ""
    
    local expected_apk=$(get_apk_name_for_abi "$device_abi")
    if [ -n "$expected_apk" ]; then
        echo -e "       APK necessario: ${CYAN}$expected_apk${NC}"
    fi
    
    echo ""
    log_info "APKs disponiveis no diretorio:"
    
    if [ -d "$apk_dir" ]; then
        local apk_files=$(ls "$apk_dir"/*.apk 2>/dev/null)
        if [ -n "$apk_files" ]; then
            for apk_file in $apk_files; do
                echo -e "       - ${GRAY}$(basename "$apk_file")${NC}"
            done
        else
            echo -e "       ${RED}(nenhum APK encontrado)${NC}"
        fi
    else
        echo -e "       ${RED}(diretorio nao existe)${NC}"
    fi
    
    echo ""
    log_info "Solucoes possiveis:"
    echo "       1. Execute o build novamente: $0"
    echo "       2. Gere APK universal modificando withAbiSplits.js"
    echo "       3. Adicione a ABI '$device_abi' na configuracao de build"
}

# Banner
echo ""
echo -e "${MAGENTA}========================================"
echo "       H5TV Debug Build Script         "
echo -e "========================================${NC}"
echo ""

# Modo InstallOnly - pula prebuild e build
if [ "$INSTALL_ONLY" = true ]; then
    log_info "Modo InstallOnly: pulando prebuild e build..."
    
    # Verificar se estamos no diretório correto
    if [ ! -f "./package.json" ]; then
        log_error "Arquivo package.json nao encontrado. Execute este script na raiz do projeto."
        exit 1
    fi
    
    # Verificar dispositivo ADB
    log_info "Verificando dispositivos conectados..."
    if ! check_adb_device; then
        log_error "Conecte um dispositivo via USB com depuracao USB habilitada"
        exit 1
    fi
    
    # Mostrar informações do dispositivo
    show_device_info
    
    # Obter ABI do dispositivo para selecionar APK correto
    DEVICE_ABI=$(get_device_abi)
    if [ -n "$DEVICE_ABI" ]; then
        log_info "Arquitetura do dispositivo: $DEVICE_ABI"
    else
        log_warning "Nao foi possivel detectar a arquitetura do dispositivo"
    fi
    
    # Localizar APK existente compatível
    APK_FILE=$(find_debug_apk "$DEVICE_ABI")
    
    if [ -z "$APK_FILE" ]; then
        show_apk_not_found_error "$DEVICE_ABI"
        exit 1
    fi
    
    FILE_SIZE=$(du -m "$APK_FILE" | cut -f1)
    log_success "APK encontrado: $APK_FILE ($FILE_SIZE MB)"
    
    if [ "$APK_FALLBACK" = true ]; then
        log_warning "AVISO: Usando APK fallback. Pode ocorrer erro INSTALL_FAILED_NO_MATCHING_ABIS"
    fi
    
    # Instalar o APK
    log_info "Instalando APK no dispositivo..."
    adb install -r "$APK_FILE"
    
    log_success "APK instalado com sucesso!"
    
    # Configurar adb reverse e Metro apenas se NÃO for standalone
    if [ "$STANDALONE" = false ]; then
        echo ""
        setup_adb_reverse
        
        # Iniciar Metro bundler (se não for --no-metro)
        if [ "$NO_METRO" = false ]; then
            echo ""
            start_metro_bundler
        else
            log_info "Pulando inicializacao do Metro (--no-metro especificado)"
            log_info "Certifique-se de que o Metro esta rodando: npx expo start"
        fi
    else
        log_info "Modo Standalone: pulando Metro e adb reverse (bundle embutido no APK)"
    fi
    
    # Iniciar o app
    echo ""
    log_info "Iniciando o app..."
    adb shell am start -n "$PACKAGE_NAME/$MAIN_ACTIVITY" || {
        log_warning "Falha ao iniciar o app automaticamente"
        log_info "Inicie o app manualmente no dispositivo"
    }
    log_success "App iniciado!"
    
    # Aguardar um pouco para o app iniciar
    sleep 2
    
    # Abrir logcat filtrado
    echo ""
    echo -e "${GREEN}========================================"
    echo "         APP RODANDO!                  "
    echo -e "========================================${NC}"
    echo ""
    log_info "Mostrando logs do React Native..."
    log_info "Pressione Ctrl+C para encerrar"
    echo ""
    echo -e "${GRAY}----------------------------------------${NC}"
    echo ""
    
    # Limpar o logcat antes de começar
    adb logcat -c
    
    # Filtrar logs do React Native e do app
    adb logcat -v time ReactNativeJS:V ReactNative:V AndroidRuntime:E System.err:W *:S
    
    exit 0
fi

# Configurar Java 17+
if ! set_java_home; then
    exit 1
fi

# Verificar se estamos no diretório correto
if [ ! -f "./package.json" ]; then
    log_error "Arquivo package.json nao encontrado. Execute este script na raiz do projeto."
    exit 1
fi

# Ler versão do package.json
VERSION=$(node -p "require('./package.json').version")
log_info "Versao detectada: v$VERSION"

# Verificar dispositivo ADB se não for skip-install
if [ "$SKIP_INSTALL" = false ]; then
    log_info "Verificando dispositivos conectados..."
    if ! check_adb_device; then
        log_error "Conecte um dispositivo via USB com depuracao USB habilitada ou use --skip-install"
        exit 1
    fi
fi

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

# Se for modo standalone, mostrar banner
if [ "$STANDALONE" = true ]; then
    echo ""
    echo -e "${YELLOW}========================================"
    echo "    MODO STANDALONE - Bundle Embutido  "
    echo -e "========================================${NC}"
    echo ""
    log_info "O bundle JavaScript sera gerado pelo Gradle com -PbundleInDebug=true"
else
    # No modo normal, limpar bundle antigo para garantir que usa Metro
    clean_js_bundle
fi

# Navegar para o diretório android
cd android

# Limpar builds anteriores se solicitado
if [ "$CLEAN" = true ]; then
    log_info "Limpando builds anteriores..."
    ./gradlew clean
    log_success "Build limpo"
fi

# Build Debug
log_info "Iniciando build de debug..."
log_info "Isso pode levar alguns minutos..."

if [ "$STANDALONE" = true ]; then
    log_info "Build Standalone: bundle JS sera incluido no APK"
    log_info "Parametro -PbundleInDebug=true: forca o React Native Gradle Plugin a gerar o bundle"
    log_info "Isso define debuggableVariants=[] para que o bundle seja gerado para debug"
    # Usar o parametro -PbundleInDebug=true para forcar o Gradle a gerar o bundle
    # Isso configura debuggableVariants=[] no react{} block, fazendo com que o
    # React Native Gradle Plugin gere o bundle mesmo em builds debug
    ./gradlew assembleDebug -PbundleInDebug=true --no-daemon
else
    log_info "Build Normal: app usara Metro bundler"
    ./gradlew assembleDebug --no-daemon
fi

log_success "Build concluido com sucesso!"

# Verificar se o bundle foi gerado (apenas em modo standalone)
if [ "$STANDALONE" = true ]; then
    BUNDLE_PATH="../app/src/main/assets/index.android.bundle"
    BUNDLE_IN_APK="./app/build/intermediates/assets/debug/mergeDebugAssets/index.android.bundle"
    
    if [ -f "$BUNDLE_IN_APK" ]; then
        BUNDLE_SIZE=$(du -k "$BUNDLE_IN_APK" | cut -f1)
        log_success "Bundle JavaScript verificado: ${BUNDLE_SIZE} KB"
    elif [ -f "$BUNDLE_PATH" ]; then
        BUNDLE_SIZE=$(du -k "$BUNDLE_PATH" | cut -f1)
        log_success "Bundle JavaScript verificado em assets: ${BUNDLE_SIZE} KB"
    else
        log_warning "Bundle JavaScript nao encontrado nos locais esperados!"
        log_warning "Verifique se o build.gradle esta configurado corretamente"
        log_warning "O app pode mostrar 'Unable to load script' se o bundle nao foi incluido"
    fi
fi

# Voltar para o diretório raiz
cd ..

# Obter ABI do dispositivo para selecionar APK correto (se não for skip-install)
DEVICE_ABI=""
if [ "$SKIP_INSTALL" = false ]; then
    DEVICE_ABI=$(get_device_abi)
    if [ -n "$DEVICE_ABI" ]; then
        log_info "Arquitetura do dispositivo: $DEVICE_ABI"
    else
        log_warning "Nao foi possivel detectar a arquitetura do dispositivo"
    fi
    
    # Mostrar informações do dispositivo
    show_device_info
fi

# Localizar o APK gerado compatível com o dispositivo
APK_FILE=$(find_debug_apk "$DEVICE_ABI")

if [ -z "$APK_FILE" ]; then
    if [ -n "$DEVICE_ABI" ]; then
        show_apk_not_found_error "$DEVICE_ABI"
    else
        APK_DIR="./android/app/build/outputs/apk/debug"
        log_error "APK debug nao encontrado em: $APK_DIR"
        log_info "Arquivos disponiveis:"
        ls -la "$APK_DIR" 2>/dev/null || echo "  (diretorio nao existe)"
    fi
    exit 1
fi

FILE_SIZE=$(du -m "$APK_FILE" | cut -f1)
log_success "APK gerado: $APK_FILE ($FILE_SIZE MB)"

if [ "$SKIP_INSTALL" = false ] && [ "$APK_FALLBACK" = true ]; then
    log_warning "AVISO: Usando APK fallback. Pode ocorrer erro INSTALL_FAILED_NO_MATCHING_ABIS"
fi

# Se skip-install, terminar aqui
if [ "$SKIP_INSTALL" = true ]; then
    echo ""
    echo -e "${GREEN}========================================"
    echo "         BUILD CONCLUIDO!              "
    echo -e "========================================${NC}"
    echo ""
    log_info "APK debug disponivel em: $APK_FILE"
    if [ "$STANDALONE" = true ]; then
        log_info "Modo: STANDALONE (bundle embutido, nao precisa de Metro)"
    else
        log_info "Modo: NORMAL (requer Metro bundler)"
    fi
    log_info "Para instalar manualmente: adb install -r \"$APK_FILE\""
    exit 0
fi

# Instalar o APK
echo ""
log_info "Instalando APK no dispositivo..."
adb install -r "$APK_FILE"

log_success "APK instalado com sucesso!"

# Configurar adb reverse e Metro apenas se NÃO for standalone
if [ "$STANDALONE" = false ]; then
    echo ""
    setup_adb_reverse
    
    # Iniciar Metro bundler (se não for --no-metro)
    if [ "$NO_METRO" = false ]; then
        echo ""
        start_metro_bundler
    else
        log_info "Pulando inicializacao do Metro (--no-metro especificado)"
        log_info "Certifique-se de que o Metro esta rodando: npx expo start"
    fi
else
    echo ""
    log_info "Modo Standalone: pulando Metro e adb reverse"
    log_info "O app carregara o bundle embutido automaticamente"
fi

# Iniciar o app
echo ""
log_info "Iniciando o app..."
adb shell am start -n "$PACKAGE_NAME/$MAIN_ACTIVITY" || {
    log_warning "Falha ao iniciar o app automaticamente"
    log_info "Inicie o app manualmente no dispositivo"
}
log_success "App iniciado!"

# Aguardar um pouco para o app iniciar
sleep 2

# Abrir logcat filtrado
echo ""
echo -e "${GREEN}========================================"
echo "         APP RODANDO!                  "
echo -e "========================================${NC}"
echo ""
log_info "Mostrando logs do React Native..."
log_info "Pressione Ctrl+C para encerrar"
echo ""
echo -e "${GRAY}----------------------------------------${NC}"
echo ""

# Limpar o logcat antes de começar
adb logcat -c

# Filtrar logs do React Native e do app
# ReactNativeJS: logs do console.log/warn/error do JavaScript
# ReactNative: logs internos do React Native
# AndroidRuntime: erros de crash
# System.err: erros do sistema
adb logcat -v time ReactNativeJS:V ReactNative:V AndroidRuntime:E System.err:W *:S

# Nota: O script termina aqui quando o usuário pressiona Ctrl+C