# build-release.ps1 - Script de Build para Produção H5TV
# Gera APKs otimizados por arquitetura para releases no GitHub

param(
    [switch]$Clean,
    [switch]$SkipPrebuild,
    [string]$OutputDir = ".\releases",
    [ValidateSet("all", "arm64", "arm", "x86", "x86_64", "universal")]
    [string]$Arch = "all"
)

$ErrorActionPreference = "Stop"

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

# Cores para output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

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

# Mapear arquiteturas
$archMapping = @{
    "arm64" = "arm64-v8a"
    "arm" = "armeabi-v7a"
    "x86" = "x86"
    "x86_64" = "x86_64"
    "universal" = "universal"
}

# Banner
Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "       H5TV Release Build Script       " -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

if ($Arch -ne "all") {
    Log-Info "Arquitetura selecionada: $Arch"
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

# Criar diretório de output se não existir
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    Log-Info "Diretorio de output criado: $OutputDir"
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

    # Build Release
    Log-Info "Iniciando build de release..."
    Log-Info "Isso pode levar alguns minutos..."
    
    # Sempre usa assembleRelease - o split por ABI é configurado no build.gradle
    # O Gradle gerará todos os APKs configurados no splits.abi
    $buildTask = "assembleRelease"
    
    Log-Info "Executando task: $buildTask"
    Log-Info "APKs serao filtrados apos o build baseado na arquitetura: $Arch"
    .\gradlew $buildTask --no-daemon
    
    if ($LASTEXITCODE -ne 0) {
        Log-Error "Falha no build de release"
        exit 1
    }
    
    Log-Success "Build concluido com sucesso!"
    
} finally {
    Pop-Location
}

# Copiar e renomear APKs
$apkDir = ".\android\app\build\outputs\apk\release"

if (-not (Test-Path $apkDir)) {
    Log-Error "Diretorio de APKs nao encontrado: $apkDir"
    exit 1
}

Log-Info "Processando APKs gerados..."

# Mapear arquivos APK para nomes padronizados
$allApkMappings = @{
    "app-arm64-v8a-release.apk" = @{ Name = "H5TV-v$version-arm64-v8a.apk"; Arch = "arm64" }
    "app-armeabi-v7a-release.apk" = @{ Name = "H5TV-v$version-armeabi-v7a.apk"; Arch = "arm" }
    "app-x86-release.apk" = @{ Name = "H5TV-v$version-x86.apk"; Arch = "x86" }
    "app-x86_64-release.apk" = @{ Name = "H5TV-v$version-x86_64.apk"; Arch = "x86_64" }
    "app-universal-release.apk" = @{ Name = "H5TV-v$version-universal.apk"; Arch = "universal" }
    "app-release.apk" = @{ Name = "H5TV-v$version-universal.apk"; Arch = "universal" }  # Fallback se não houver splits
}

$copiedFiles = @()

foreach ($mapping in $allApkMappings.GetEnumerator()) {
    $sourceFile = Join-Path $apkDir $mapping.Key
    $destFile = Join-Path $OutputDir $mapping.Value.Name
    
    # Filtrar por arquitetura se especificada
    if ($Arch -ne "all" -and $mapping.Value.Arch -ne $Arch) {
        continue
    }
    
    if (Test-Path $sourceFile) {
        Copy-Item $sourceFile $destFile -Force
        $fileSize = (Get-Item $destFile).Length / 1MB
        $copiedFiles += @{
            Name = $mapping.Value.Name
            Size = [math]::Round($fileSize, 2)
            Path = $destFile
        }
        Log-Success "Copiado: $($mapping.Value.Name) ($([math]::Round($fileSize, 2)) MB)"
    } else {
        if ($Arch -eq "all" -or $mapping.Value.Arch -eq $Arch) {
            Log-Warning "Arquivo nao encontrado: $($mapping.Key)"
        }
    }
}

# Resumo final
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "         BUILD CONCLUIDO!              " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Log-Info "Versao: v$version"
Log-Info "APKs gerados em: $OutputDir"
Write-Host ""

Write-Host "Arquivos prontos para release:" -ForegroundColor Cyan
foreach ($file in $copiedFiles) {
    Write-Host "  - $($file.Name) ($($file.Size) MB)" -ForegroundColor White
}

Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Yellow
Write-Host "  1. Testar os APKs em dispositivos reais"
Write-Host "  2. Criar uma nova release no GitHub"
Write-Host "  3. Fazer upload dos APKs como assets da release"
Write-Host "  4. Marcar a release com a tag v$version"
Write-Host ""

# Abrir pasta de releases (opcional)
$openFolder = Read-Host "Deseja abrir a pasta de releases? (S/N)"
if ($openFolder -eq "S" -or $openFolder -eq "s") {
    Start-Process explorer.exe $OutputDir
}