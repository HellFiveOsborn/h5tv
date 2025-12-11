# build-debug.ps1 - Script de Build Debug para H5TV
# Gera APK debug, instala no dispositivo e mostra logs em tempo real

param(
    [switch]$Clean,
    [switch]$SkipPrebuild,
    [switch]$SkipInstall,
    [switch]$InstallOnly,
    [switch]$NoMetro,
    [switch]$Standalone,
    [switch]$Help,
    [Alias("h")]
    [switch]$ShowHelp
)

$ErrorActionPreference = "Stop"

# Package name do app (definido no app.json)
$PACKAGE_NAME = "com.hellfiveosborn.H5TV"
$MAIN_ACTIVITY = "$PACKAGE_NAME.MainActivity"

# Cores para output
function Log-Info($message) {
    Write-Host "[INFO] " -ForegroundColor Cyan -NoNewline
    Write-Host $message
}

function Log-Success($message) {
    Write-Host "[OK] " -ForegroundColor Green -NoNewline
    Write-Host $message
}

function Log-Warning($message) {
    Write-Host "[WARN] " -ForegroundColor Yellow -NoNewline
    Write-Host $message
}

function Log-Error($message) {
    Write-Host "[ERROR] " -ForegroundColor Red -NoNewline
    Write-Host $message
}

function Log-Debug($message) {
    Write-Host "[DEBUG] " -ForegroundColor Magenta -NoNewline
    Write-Host $message
}

# Função de ajuda
function Show-Help {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "       H5TV Debug Build Script         " -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Uso: .\build-debug.ps1 [opcoes]" -ForegroundColor White
    Write-Host ""
    Write-Host "Opcoes:" -ForegroundColor Yellow
    Write-Host "  -Clean          Limpa builds anteriores antes de compilar"
    Write-Host "  -SkipPrebuild   Pula o expo prebuild (usa android existente)"
    Write-Host "  -SkipInstall    Apenas gera o APK, nao instala no dispositivo"
    Write-Host "  -InstallOnly    Instala APK existente sem rebuild (pula prebuild e build)"
    Write-Host "  -NoMetro        Pula inicializacao do Metro (use se ja estiver rodando)"
    Write-Host "  -Standalone     Gera APK com bundle JS embutido (nao precisa do Metro)"
    Write-Host "  -Help, -h       Mostra esta mensagem de ajuda"
    Write-Host ""
    Write-Host "Exemplos:" -ForegroundColor Yellow
    Write-Host "  .\build-debug.ps1                    # Build completo com instalacao e logs"
    Write-Host "  .\build-debug.ps1 -Clean             # Build limpo"
    Write-Host "  .\build-debug.ps1 -SkipPrebuild      # Pula prebuild (mais rapido)"
    Write-Host "  .\build-debug.ps1 -SkipInstall       # Apenas gera APK"
    Write-Host "  .\build-debug.ps1 -InstallOnly       # Instala APK existente sem rebuild"
    Write-Host "  .\build-debug.ps1 -NoMetro           # Nao inicia o Metro (ja rodando)"
    Write-Host "  .\build-debug.ps1 -Standalone        # APK standalone (bundle embutido)"
    Write-Host ""
    Write-Host "Modos de Build:" -ForegroundColor Cyan
    Write-Host "  Normal (sem -Standalone):" -ForegroundColor White
    Write-Host "    - Requer Metro bundler rodando para carregar o JavaScript"
    Write-Host "    - Ideal para desenvolvimento (hot reload, fast refresh)"
    Write-Host "    - O app conecta ao Metro na porta 8081"
    Write-Host ""
    Write-Host "  Standalone (-Standalone):" -ForegroundColor White
    Write-Host "    - Bundle JavaScript embutido no APK (como release)"
    Write-Host "    - NAO precisa do Metro bundler"
    Write-Host "    - Ideal para testar componentes nativos (ex: NativeStreamWebView)"
    Write-Host "    - Funciona offline, igual ao APK de producao"
    Write-Host ""
    Write-Host "O script ira:" -ForegroundColor Cyan
    Write-Host "  1. Executar expo prebuild (se necessario)"
    Write-Host "  2. Gerar bundle JS (apenas com -Standalone)"
    Write-Host "  3. Gerar APK em modo debug"
    Write-Host "  4. Instalar o APK no dispositivo conectado via ADB"
    Write-Host "  5. Configurar conexao reversa (apenas sem -Standalone)"
    Write-Host "  6. Iniciar o Metro bundler (apenas sem -Standalone)"
    Write-Host "  7. Iniciar o app automaticamente"
    Write-Host "  8. Abrir o logcat filtrado para logs do React Native"
    Write-Host ""
    Write-Host "Pressione Ctrl+C para encerrar o logcat" -ForegroundColor Yellow
    Write-Host ""
}

# Função para configurar adb reverse
function Setup-AdbReverse {
    Log-Info "Configurando conexao reversa (adb reverse tcp:8081 tcp:8081)..."
    & adb reverse tcp:8081 tcp:8081
    if ($LASTEXITCODE -eq 0) {
        Log-Success "Conexao reversa configurada - dispositivo pode acessar Metro na porta 8081"
    } else {
        Log-Warning "Falha ao configurar conexao reversa - o app pode nao conseguir carregar o bundle"
    }
}

# Função para iniciar o Metro bundler
function Start-MetroBundler {
    Log-Info "Iniciando Metro bundler em nova janela..."
    $workDir = (Get-Location).Path
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$workDir'; Write-Host 'Metro Bundler - H5TV Debug' -ForegroundColor Cyan; Write-Host ''; npx expo start"
    Log-Success "Metro bundler iniciado em nova janela"
    Write-Host ""
    Log-Info "Aguardando Metro inicializar (5 segundos)..."
    Start-Sleep -Seconds 5
    Write-Host ""
    Write-Host "----------------------------------------" -ForegroundColor Yellow
    Write-Host "  DICA: Se o app mostrar 'Unable to load script'," -ForegroundColor Yellow
    Write-Host "  pressione 'r' na janela do Metro para reload" -ForegroundColor Yellow
    Write-Host "----------------------------------------" -ForegroundColor Yellow
    Write-Host ""
}

# Função para limpar bundle anterior (para builds normais)
function Clean-JsBundle {
    $bundlePath = ".\android\app\src\main\assets\index.android.bundle"
    if (Test-Path $bundlePath) {
        Remove-Item $bundlePath -Force
        Log-Debug "Bundle anterior removido"
    }
}

# Verificar e configurar JAVA_HOME para Java 17+
function Set-JavaHome {
    $requiredVersion = 17
    
    # Verificar versão atual do Java
    $currentJavaVersion = $null
    try {
        $versionOutput = & java -version 2>&1 | Select-Object -First 1
        if ($versionOutput -match '"(\d+)') {
            $currentJavaVersion = [int]$Matches[1]
            # Para Java 8, o formato é "1.8.x"
            if ($currentJavaVersion -eq 1) {
                if ($versionOutput -match '"1\.(\d+)') {
                    $currentJavaVersion = [int]$Matches[1]
                }
            }
        }
    } catch {}
    
    if ($currentJavaVersion -ge $requiredVersion) {
        Log-Info "Java $currentJavaVersion detectado - OK"
        return $true
    }
    
    Log-Warning "Java atual ($currentJavaVersion) e inferior a $requiredVersion"
    
    # Procurar por instalações de Java 17+
    $javaPaths = @(
        "C:\Program Files\Java\jdk-17",
        "C:\Program Files\Java\jdk-21",
        "C:\Program Files\Eclipse Adoptium\jdk-17*",
        "C:\Program Files\Eclipse Adoptium\jdk-21*",
        "C:\Program Files\Microsoft\jdk-17*",
        "C:\Program Files\Microsoft\jdk-21*",
        "C:\Program Files\Zulu\zulu-17*",
        "C:\Program Files\Zulu\zulu-21*"
    )
    
    foreach ($pattern in $javaPaths) {
        $paths = Get-Item -Path $pattern -ErrorAction SilentlyContinue
        foreach ($path in $paths) {
            if (Test-Path "$($path.FullName)\bin\java.exe") {
                Log-Info "Encontrado Java em: $($path.FullName)"
                $env:JAVA_HOME = $path.FullName
                $env:PATH = "$($path.FullName)\bin;$env:PATH"
                Log-Success "JAVA_HOME configurado para: $($path.FullName)"
                return $true
            }
        }
    }
    
    Log-Error "Java 17 ou superior nao encontrado. Instale o JDK 17 de: https://adoptium.net/"
    return $false
}

# Verificar se há dispositivo ADB conectado
function Test-AdbDevice {
    try {
        $devices = & adb devices 2>&1 | Select-String "device$"
        if ($devices) {
            $deviceCount = ($devices | Measure-Object).Count
            Log-Success "$deviceCount dispositivo(s) conectado(s)"
            return $true
        } else {
            Log-Warning "Nenhum dispositivo conectado via ADB"
            return $false
        }
    } catch {
        Log-Error "ADB nao encontrado. Verifique se o Android SDK esta instalado e no PATH"
        return $false
    }
}

# Obter a ABI/arquitetura do dispositivo conectado
function Get-DeviceAbi {
    try {
        $abi = (& adb shell getprop ro.product.cpu.abi 2>&1).Trim()
        if ($abi -and -not ($abi -match "error|device")) {
            return $abi
        }
    } catch {}
    return $null
}

# Obter lista de ABIs suportadas pelo dispositivo
function Get-DeviceAbiList {
    try {
        $abiList = (& adb shell getprop ro.product.cpu.abilist 2>&1).Trim()
        if ($abiList -and -not ($abiList -match "error|device")) {
            return $abiList -split ","
        }
    } catch {}
    return @()
}

# Mostrar informações do dispositivo conectado
function Show-DeviceInfo {
    try {
        $deviceInfo = & adb devices -l 2>&1 | Select-String "device " | Select-Object -First 1
        if ($deviceInfo) {
            $line = $deviceInfo.ToString()
            
            # Extrair informações usando regex
            $model = ""
            $device = ""
            $transportId = ""
            
            if ($line -match "model:(\S+)") {
                $model = $Matches[1]
            }
            if ($line -match "device:(\S+)") {
                $device = $Matches[1]
            }
            if ($line -match "transport_id:(\S+)") {
                $transportId = $Matches[1]
            }
            
            # Obter ABI do dispositivo
            $abi = Get-DeviceAbi
            $abiList = Get-DeviceAbiList
            
            Write-Host ""
            Log-Info "Dispositivo detectado:"
            if ($model) {
                Write-Host "       Modelo: " -NoNewline
                Write-Host $model -ForegroundColor White
            }
            if ($device) {
                Write-Host "       Device: " -NoNewline
                Write-Host $device -ForegroundColor White
            }
            if ($abi) {
                Write-Host "       ABI: " -NoNewline
                Write-Host $abi -ForegroundColor Yellow
            }
            if ($abiList -and $abiList.Count -gt 1) {
                Write-Host "       ABIs suportadas: " -NoNewline
                Write-Host ($abiList -join ", ") -ForegroundColor Gray
            }
            if ($transportId) {
                Write-Host "       Transport ID: " -NoNewline
                Write-Host $transportId -ForegroundColor White
            }
            Write-Host ""
        }
    } catch {
        Log-Warning "Nao foi possivel obter informacoes do dispositivo"
    }
}

# Mapear ABI para nome do APK
function Get-ApkNameForAbi {
    param([string]$abi)
    
    $abiMapping = @{
        "arm64-v8a" = "app-arm64-v8a-debug.apk"
        "armeabi-v7a" = "app-armeabi-v7a-debug.apk"
        "x86" = "app-x86-debug.apk"
        "x86_64" = "app-x86_64-debug.apk"
    }
    
    if ($abiMapping.ContainsKey($abi)) {
        return $abiMapping[$abi]
    }
    return $null
}

# Localizar APK de debug compatível com o dispositivo
function Find-DebugApk {
    param([string]$deviceAbi = $null)
    
    $apkDir = ".\android\app\build\outputs\apk\debug"
    $selectedApk = $null
    $usedFallback = $false
    
    # Se temos a ABI do dispositivo, tentar encontrar APK específico
    if ($deviceAbi) {
        $specificApk = Get-ApkNameForAbi -abi $deviceAbi
        if ($specificApk) {
            $testPath = Join-Path $apkDir $specificApk
            if (Test-Path $testPath) {
                Log-Success "APK especifico encontrado para arquitetura $deviceAbi"
                return @{
                    Path = $testPath
                    Fallback = $false
                    TargetAbi = $deviceAbi
                }
            }
            Log-Warning "APK especifico para $deviceAbi nao encontrado: $specificApk"
        }
        
        # Tentar ABIs compatíveis (ex: arm64-v8a pode rodar armeabi-v7a)
        $compatibleAbis = @()
        switch ($deviceAbi) {
            "arm64-v8a" { $compatibleAbis = @("armeabi-v7a") }
            "x86_64" { $compatibleAbis = @("x86") }
        }
        
        foreach ($compatAbi in $compatibleAbis) {
            $compatApk = Get-ApkNameForAbi -abi $compatAbi
            if ($compatApk) {
                $testPath = Join-Path $apkDir $compatApk
                if (Test-Path $testPath) {
                    Log-Warning "Usando APK compativel ($compatAbi) para dispositivo $deviceAbi"
                    return @{
                        Path = $testPath
                        Fallback = $true
                        TargetAbi = $compatAbi
                    }
                }
            }
        }
    }
    
    # Fallback: tentar APK universal ou genérico
    $fallbackApks = @(
        "app-universal-debug.apk",
        "app-debug.apk"
    )
    
    foreach ($apk in $fallbackApks) {
        $testPath = Join-Path $apkDir $apk
        if (Test-Path $testPath) {
            if ($deviceAbi) {
                Log-Warning "Usando APK fallback: $apk (dispositivo requer $deviceAbi)"
            }
            return @{
                Path = $testPath
                Fallback = $true
                TargetAbi = "universal"
            }
        }
    }
    
    # Último recurso: qualquer APK disponível
    $anyApks = @(
        "app-arm64-v8a-debug.apk",
        "app-armeabi-v7a-debug.apk",
        "app-x86-debug.apk",
        "app-x86_64-debug.apk"
    )
    
    foreach ($apk in $anyApks) {
        $testPath = Join-Path $apkDir $apk
        if (Test-Path $testPath) {
            Log-Warning "ATENCAO: Usando APK $apk que pode NAO ser compativel com o dispositivo ($deviceAbi)"
            return @{
                Path = $testPath
                Fallback = $true
                TargetAbi = $apk -replace "app-|-debug\.apk", ""
            }
        }
    }
    
    return $null
}

# Mostrar erro detalhado quando APK não é encontrado
function Show-ApkNotFoundError {
    param([string]$deviceAbi)
    
    $apkDir = ".\android\app\build\outputs\apk\debug"
    
    Log-Error "Nenhum APK compativel encontrado!"
    Write-Host ""
    Write-Host "       Arquitetura do dispositivo: " -NoNewline
    Write-Host $deviceAbi -ForegroundColor Yellow
    Write-Host ""
    
    $expectedApk = Get-ApkNameForAbi -abi $deviceAbi
    if ($expectedApk) {
        Write-Host "       APK necessario: " -NoNewline
        Write-Host $expectedApk -ForegroundColor Cyan
    }
    
    Write-Host ""
    Log-Info "APKs disponiveis no diretorio:"
    
    if (Test-Path $apkDir) {
        $files = Get-ChildItem $apkDir -Filter "*.apk" -ErrorAction SilentlyContinue
        if ($files) {
            foreach ($file in $files) {
                Write-Host "       - $($file.Name)" -ForegroundColor Gray
            }
        } else {
            Write-Host "       (nenhum APK encontrado)" -ForegroundColor Red
        }
    } else {
        Write-Host "       (diretorio nao existe)" -ForegroundColor Red
    }
    
    Write-Host ""
    Log-Info "Solucoes possiveis:"
    Write-Host "       1. Execute o build novamente: .\build-debug.ps1"
    Write-Host "       2. Gere APK universal modificando withAbiSplits.js"
    Write-Host "       3. Adicione a ABI '$deviceAbi' na configuracao de build"
}

# Mostrar ajuda se solicitado
if ($Help -or $ShowHelp) {
    Show-Help
    exit 0
}

# Banner
Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "       H5TV Debug Build Script         " -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

# Modo InstallOnly - pula prebuild e build
if ($InstallOnly) {
    Log-Info "Modo InstallOnly: pulando prebuild e build..."
    
    # Verificar se estamos no diretório correto
    if (-not (Test-Path ".\package.json")) {
        Log-Error "Arquivo package.json nao encontrado. Execute este script na raiz do projeto."
        exit 1
    }
    
    # Verificar dispositivo ADB
    Log-Info "Verificando dispositivos conectados..."
    if (-not (Test-AdbDevice)) {
        Log-Error "Conecte um dispositivo via USB com depuracao USB habilitada"
        exit 1
    }
    
    # Mostrar informações do dispositivo
    Show-DeviceInfo
    
    # Obter ABI do dispositivo para selecionar APK correto
    $deviceAbi = Get-DeviceAbi
    if ($deviceAbi) {
        Log-Info "Arquitetura do dispositivo: $deviceAbi"
    } else {
        Log-Warning "Nao foi possivel detectar a arquitetura do dispositivo"
    }
    
    # Localizar APK existente compatível
    $apkResult = Find-DebugApk -deviceAbi $deviceAbi
    
    if (-not $apkResult) {
        Show-ApkNotFoundError -deviceAbi $deviceAbi
        exit 1
    }
    
    $apkFile = $apkResult.Path
    $fileSize = (Get-Item $apkFile).Length / 1MB
    Log-Success "APK encontrado: $apkFile ($([math]::Round($fileSize, 2)) MB)"
    
    if ($apkResult.Fallback) {
        Log-Warning "AVISO: Usando APK fallback. Pode ocorrer erro INSTALL_FAILED_NO_MATCHING_ABIS"
    }
    
    # Instalar o APK
    Log-Info "Instalando APK no dispositivo..."
    & adb install -r $apkFile
    
    if ($LASTEXITCODE -ne 0) {
        Log-Error "Falha ao instalar o APK"
        exit 1
    }
    Log-Success "APK instalado com sucesso!"
    
    # Configurar adb reverse e Metro apenas se NÃO for standalone
    if (-not $Standalone) {
        Write-Host ""
        Setup-AdbReverse
        
        # Iniciar Metro bundler (se não for -NoMetro)
        if (-not $NoMetro) {
            Write-Host ""
            Start-MetroBundler
        } else {
            Log-Info "Pulando inicializacao do Metro (-NoMetro especificado)"
            Log-Info "Certifique-se de que o Metro esta rodando: npx expo start"
        }
    } else {
        Log-Info "Modo Standalone: pulando Metro e adb reverse (bundle embutido no APK)"
    }
    
    # Iniciar o app
    Write-Host ""
    Log-Info "Iniciando o app..."
    & adb shell am start -n "$PACKAGE_NAME/$MAIN_ACTIVITY"
    
    if ($LASTEXITCODE -ne 0) {
        Log-Warning "Falha ao iniciar o app automaticamente"
        Log-Info "Inicie o app manualmente no dispositivo"
    }
    Log-Success "App iniciado!"
    
    # Aguardar um pouco para o app iniciar
    Start-Sleep -Seconds 2
    
    # Abrir logcat filtrado
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "         APP RODANDO!                  " -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Log-Info "Mostrando logs do React Native..."
    Log-Info "Pressione Ctrl+C para encerrar"
    Write-Host ""
    Write-Host "----------------------------------------" -ForegroundColor DarkGray
    Write-Host ""
    
    # Limpar o logcat antes de começar
    & adb logcat -c
    
    # Filtrar logs do React Native e do app
    & adb logcat -v time ReactNativeJS:V ReactNative:V AndroidRuntime:E System.err:W *:S
    
    exit 0
}

# Configurar Java 17+
if (-not (Set-JavaHome)) {
    exit 1
}

# Verificar se estamos no diretório correto
if (-not (Test-Path ".\package.json")) {
    Log-Error "Arquivo package.json nao encontrado. Execute este script na raiz do projeto."
    exit 1
}

# Ler versão do package.json
$packageJson = Get-Content ".\package.json" | ConvertFrom-Json
$version = $packageJson.version
Log-Info "Versao detectada: v$version"

# Verificar dispositivo ADB se não for SkipInstall
if (-not $SkipInstall) {
    Log-Info "Verificando dispositivos conectados..."
    if (-not (Test-AdbDevice)) {
        Log-Error "Conecte um dispositivo via USB com depuracao USB habilitada ou use -SkipInstall"
        exit 1
    }
}

# Verificar se o diretório android existe
if (-not (Test-Path ".\android")) {
    Log-Warning "Diretorio android nao encontrado. Executando prebuild..."
    $SkipPrebuild = $false
}

# Executar prebuild se necessário
if (-not $SkipPrebuild) {
    Log-Info "Executando expo prebuild..."
    if ($Clean) {
        npx expo prebuild --clean
    } else {
        npx expo prebuild
    }
    if ($LASTEXITCODE -ne 0) {
        Log-Error "Falha no expo prebuild"
        exit 1
    }
    Log-Success "Prebuild concluido"
}

# Se for modo standalone, mostrar banner
if ($Standalone) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "    MODO STANDALONE - Bundle Embutido  " -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Log-Info "O bundle JavaScript sera gerado pelo Gradle com -PbundleInDebug=true"
} else {
    # No modo normal, limpar bundle antigo para garantir que usa Metro
    Clean-JsBundle
}

# Navegar para o diretório android
Push-Location .\android

try {
    # Limpar builds anteriores se solicitado
    if ($Clean) {
        Log-Info "Limpando builds anteriores..."
        .\gradlew clean
        Log-Success "Build limpo"
    }

    # Build Debug
    Log-Info "Iniciando build de debug..."
    Log-Info "Isso pode levar alguns minutos..."
    
    if ($Standalone) {
        Log-Info "Build Standalone: bundle JS sera incluido no APK"
        Log-Info "Parametro -PbundleInDebug=true: forca o React Native Gradle Plugin a gerar o bundle"
        Log-Info "Isso define debuggableVariants=[] para que o bundle seja gerado para debug"
        # Usar o parametro -PbundleInDebug=true para forcar o Gradle a gerar o bundle
        # Isso configura debuggableVariants=[] no react{} block, fazendo com que o
        # React Native Gradle Plugin gere o bundle mesmo em builds debug
        .\gradlew assembleDebug -PbundleInDebug=true --no-daemon
    } else {
        Log-Info "Build Normal: app usara Metro bundler"
        .\gradlew assembleDebug --no-daemon
    }
    
    if ($LASTEXITCODE -ne 0) {
        Log-Error "Falha no build de debug"
        exit 1
    }
    
    Log-Success "Build concluido com sucesso!"
    
    # Verificar se o bundle foi gerado (apenas em modo standalone)
    if ($Standalone) {
        $bundlePath = "..\app\src\main\assets\index.android.bundle"
        $bundleInApk = ".\app\build\intermediates\assets\debug\mergeDebugAssets\index.android.bundle"
        
        if (Test-Path $bundleInApk) {
            $bundleSize = (Get-Item $bundleInApk).Length / 1KB
            Log-Success "Bundle JavaScript verificado: $([math]::Round($bundleSize, 2)) KB"
        } elseif (Test-Path $bundlePath) {
            $bundleSize = (Get-Item $bundlePath).Length / 1KB
            Log-Success "Bundle JavaScript verificado em assets: $([math]::Round($bundleSize, 2)) KB"
        } else {
            Log-Warning "Bundle JavaScript nao encontrado nos locais esperados!"
            Log-Warning "Verifique se o build.gradle esta configurado corretamente"
            Log-Warning "O app pode mostrar 'Unable to load script' se o bundle nao foi incluido"
        }
    }
    
} finally {
    Pop-Location
}

# Obter ABI do dispositivo para selecionar APK correto (se não for SkipInstall)
$deviceAbi = $null
if (-not $SkipInstall) {
    $deviceAbi = Get-DeviceAbi
    if ($deviceAbi) {
        Log-Info "Arquitetura do dispositivo: $deviceAbi"
    } else {
        Log-Warning "Nao foi possivel detectar a arquitetura do dispositivo"
    }
    
    # Mostrar informações do dispositivo
    Show-DeviceInfo
}

# Localizar o APK gerado compatível com o dispositivo
$apkResult = Find-DebugApk -deviceAbi $deviceAbi

if (-not $apkResult) {
    if ($deviceAbi) {
        Show-ApkNotFoundError -deviceAbi $deviceAbi
    } else {
        $apkDir = ".\android\app\build\outputs\apk\debug"
        Log-Error "APK debug nao encontrado em: $apkDir"
        Log-Info "Arquivos disponiveis:"
        Get-ChildItem $apkDir -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  - $($_.Name)" }
    }
    exit 1
}

$apkFile = $apkResult.Path
$fileSize = (Get-Item $apkFile).Length / 1MB
Log-Success "APK gerado: $apkFile ($([math]::Round($fileSize, 2)) MB)"

if (-not $SkipInstall -and $apkResult.Fallback) {
    Log-Warning "AVISO: Usando APK fallback. Pode ocorrer erro INSTALL_FAILED_NO_MATCHING_ABIS"
}

# Se SkipInstall, terminar aqui
if ($SkipInstall) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "         BUILD CONCLUIDO!              " -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Log-Info "APK debug disponivel em: $apkFile"
    if ($Standalone) {
        Log-Info "Modo: STANDALONE (bundle embutido, nao precisa de Metro)"
    } else {
        Log-Info "Modo: NORMAL (requer Metro bundler)"
    }
    Log-Info "Para instalar manualmente: adb install -r `"$apkFile`""
    exit 0
}

# Instalar o APK
Write-Host ""
Log-Info "Instalando APK no dispositivo..."
& adb install -r $apkFile

if ($LASTEXITCODE -ne 0) {
    Log-Error "Falha ao instalar o APK"
    exit 1
}
Log-Success "APK instalado com sucesso!"

# Configurar adb reverse e Metro apenas se NÃO for standalone
if (-not $Standalone) {
    Write-Host ""
    Setup-AdbReverse
    
    # Iniciar Metro bundler (se não for -NoMetro)
    if (-not $NoMetro) {
        Write-Host ""
        Start-MetroBundler
    } else {
        Log-Info "Pulando inicializacao do Metro (-NoMetro especificado)"
        Log-Info "Certifique-se de que o Metro esta rodando: npx expo start"
    }
} else {
    Write-Host ""
    Log-Info "Modo Standalone: pulando Metro e adb reverse"
    Log-Info "O app carregara o bundle embutido automaticamente"
}

# Iniciar o app
Write-Host ""
Log-Info "Iniciando o app..."
& adb shell am start -n "$PACKAGE_NAME/$MAIN_ACTIVITY"

if ($LASTEXITCODE -ne 0) {
    Log-Warning "Falha ao iniciar o app automaticamente"
    Log-Info "Inicie o app manualmente no dispositivo"
}
Log-Success "App iniciado!"

# Aguardar um pouco para o app iniciar
Start-Sleep -Seconds 2

# Abrir logcat filtrado
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "         APP RODANDO!                  " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Log-Info "Mostrando logs do React Native..."
Log-Info "Pressione Ctrl+C para encerrar"
Write-Host ""
Write-Host "----------------------------------------" -ForegroundColor DarkGray
Write-Host ""

# Limpar o logcat antes de começar
& adb logcat -c

# Filtrar logs do React Native e do app
# ReactNativeJS: logs do console.log/warn/error do JavaScript
# ReactNative: logs internos do React Native
# H5TV: tag customizada se usada
# Também filtra pelo package name para pegar crashes e erros do sistema relacionados ao app
& adb logcat -v time ReactNativeJS:V ReactNative:V AndroidRuntime:E System.err:W *:S

# Nota: O script termina aqui quando o usuário pressiona Ctrl+C