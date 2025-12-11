# Revisão de Otimização de APK - H5TV

Este documento analisa o projeto H5TV e identifica oportunidades para reduzir o tamanho do APK final.

## 📊 Tamanhos Atuais (v1.3.0)

| Arquivo | Tamanho |
|---------|---------|
| H5TV-v1.3.0-armeabi-v7a.apk | **28.5 MB** |
| H5TV-v1.3.0-arm64-v8a.apk | **32.9 MB** |
| H5TV-v1.3.0-x86.apk | **33.9 MB** |
| H5TV-v1.3.0-x86_64.apk | **33.4 MB** |
| H5TV-v1.3.0-universal.apk | **72.9 MB** |

## 📦 Análise de Dependências

### Dependências Atuais (`package.json`)

```json
{
  "dependencies": {
    "@expo/vector-icons": "^15.0.3",          // ~5-10 MB (inclui TODAS as fontes)
    "@react-native-async-storage/async-storage": "2.2.0",  // ~100 KB
    "expo": "~54.0.25",                        // Core ~2-3 MB
    "expo-application": "~7.0.7",             // ~50 KB
    "expo-constants": "~18.0.10",             // ~100 KB
    "expo-file-system": "~19.0.19",           // ~200 KB
    "expo-intent-launcher": "~13.0.7",        // ~50 KB
    "expo-keep-awake": "~15.0.7",             // ~30 KB
    "expo-linear-gradient": "~15.0.7",        // ~100 KB
    "expo-linking": "~8.0.9",                 // ~50 KB
    "expo-navigation-bar": "~5.0.9",          // ~50 KB
    "expo-network": "~8.0.7",                 // ~50 KB
    "expo-router": "~6.0.15",                 // ~300 KB
    "expo-status-bar": "~3.0.8",              // ~30 KB
    "react": "19.1.0",                        // ~150 KB
    "react-native": "0.81.5",                 // Core ~10-15 MB
    "react-native-markdown-display": "^7.0.2", // ~200 KB
    "react-native-safe-area-context": "~5.6.0", // ~100 KB
    "react-native-screens": "~4.16.0",        // ~300 KB
    "react-native-video": "^6.10.0",          // ~5-8 MB (ExoPlayer)
    "react-native-webview": "13.15.0"         // ~2-3 MB
  }
}
```

### 🔴 Oportunidades de Remoção/Otimização

#### 1. **`@expo/vector-icons`** - Alto Impacto (~5-10 MB)
**Status:** Usado apenas para ícones Ionicons
**Problema:** Inclui TODAS as famílias de fontes (FontAwesome, Material, etc.)
**Solução:**
```typescript
// ATUAL - Importa toda a biblioteca
import { Ionicons } from '@expo/vector-icons';

// OTIMIZADO - Importar apenas Ionicons
import Ionicons from '@expo/vector-icons/Ionicons';
```

---

#### 2. **`expo-linear-gradient`** - Baixo Impacto (~100 KB)
**Status:** Usado em `GameSlider.tsx` e `index.tsx`
**Problema:** Pode ser substituído por CSS gradients ou View overlay
**Solução:** Substituir por componente customizado com `View` + opacity
**Economia estimada:** 100 KB

---

#### 3. **`expo-keep-awake`** - Mínimo Impacto (~30 KB)
**Status:** Não encontrado uso explícito no código analisado
**Verificar:** Se está realmente sendo usado
**Economia estimada:** 30 KB

---

## 🖼️ Análise de Assets

### Assets Atuais (`assets/`)

| Arquivo | Formato | Uso | Status |
|---------|---------|-----|--------|
| `adaptive-icon.png` | PNG | Icon Android | ✅ Mantido |
| `icon.png` | PNG | App Icon | ✅ Mantido |
| `logo.png` | PNG | Splash | ✅ Mantido |
| `banner1.webp` | WebP | GameSlider | ✅ OK |
| `banner2.webp` | WebP | GameSlider | ✅ OK |
| `banner3.webp` | WebP | GameSlider | ✅ OK |
| `banner4.webp` | WebP | GameSlider | ✅ OK |
| `logo_banner.webp` | WebP | UI | ✅ Convertido |
| `tv_banner.webp` | WebP | UI | ✅ Convertido |

*Nota: `favicon.png`, `splash-icon.png` e `banner.png` foram removidos durante a otimização.*

### Recomendações de Assets ✅ Concluídas

1. ~~**Remover `favicon.png`**~~ - ✅ Removido
2. ~~**Converter PNGs para WebP**~~ - ✅ `logo_banner` e `tv_banner` convertidos
3. ~~**Verificar duplicatas**~~ - ✅ `splash-icon.png` removido (duplicata)

**Economia realizada:** ~200-400 KB

---

## 📱 Análise de Código Nativo (Plugins)

### Plugins Atuais

```json
"plugins": [
  "expo-router",                    // ✅ Necessário
  "./plugins/withBootReceiver.js",  // ✅ Necessário (boot on startup)
  "./plugins/withAbiSplits.js",     // ✅ Necessário (APKs separados)
  "./plugins/withStreamInterceptor.js" // ✅ Necessário (WebView nativo)
]
```

### Análise

1. ~~**`withExoPlayerBuffer.js`**~~ - ✅ **Removido**
   - Plugin e arquivos Kotlin associados foram deletados
   - Não estava sendo usado no `app.json`

2. **`withStreamInterceptor.js`** - ✅ Otimizado e mantido
   - Código simplificado e necessário para WebView nativo

---

## 🔧 Configurações de Build

### Proguard/R8 (Minificação)

Verificar se o R8 está habilitado em `android/app/build.gradle`:

```gradle
android {
    buildTypes {
        release {
            minifyEnabled true       // Habilitar minificação
            shrinkResources true     // Remover recursos não usados
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

**Economia estimada:** 10-20% do tamanho total

### Hermes Engine

Verificar se Hermes está habilitado (deve estar por padrão no Expo 52):
```json
// app.json
{
  "expo": {
    "jsEngine": "hermes"
  }
}
```

---

## 📋 Código Morto/Não Usado

### Componentes Potencialmente Não Usados ✅ Auditados

| Arquivo | Status | Ação Realizada |
|---------|--------|----------------|
| `src/components/SearchInput.tsx` | ✅ Usado | Mantido (usado em SearchOverlay) |
| `src/components/SettingsModal.tsx` | ❌ Não usado | Removido |
| `src/services/timeService.ts` | ✅ Usado | Mantido |

### Imports de Platform.OS ✅ Limpos

Código iOS-only foi removido durante a auditoria:

- ✅ `_layout.tsx` - Removidas verificações de iOS
- ✅ `SettingsScreen.tsx` - Limpos imports não usados
- ✅ Demais componentes auditados

---

## 🗂️ Configuração app.json

### Otimizações Recomendadas

```json
{
  "expo": {
    // REMOVER - Não é necessário para Android TV
    "ios": {
      "supportsTablet": true
    },
    
    // REMOVER - Não é necessário para Android TV  
    "web": {
      "favicon": "./assets/favicon.png"
    },
    
    // ADICIONAR - Excluir arquivos desnecessários
    "assetBundlePatterns": [
      "assets/banner*.webp",
      "assets/adaptive-icon.png",
      "assets/icon.png",
      "assets/logo.png"
    ]
  }
}
```

---

## 📊 Resumo de Economia Estimada

| Categoria | Economia Estimada |
|-----------|-------------------|
| @expo/vector-icons (otimização) | 3-5 MB |
| react-native-markdown-display | 200-300 KB |
| expo-linear-gradient | 100 KB |
| Assets (WebP + remoção) | 100-500 KB |
| Código morto iOS | 50-100 KB |
| R8/Proguard (se não habilitado) | 3-6 MB |
| **TOTAL ESTIMADO** | **7-12 MB** |

### Projeção de Tamanhos Após Otimização

| Arquivo | Atual | Projetado |
|---------|-------|-----------|
| armeabi-v7a | 28.5 MB | ~20-24 MB |
| arm64-v8a | 32.9 MB | ~24-28 MB |
| x86 | 33.9 MB | ~25-29 MB |
| x86_64 | 33.4 MB | ~25-29 MB |

---

## ✅ Plano de Ação Recomendado

### Fase 1 - Alto Impacto (Fácil)
1. [x] ~~Otimizar imports de `@expo/vector-icons`~~ (Imports otimizados para `@expo/vector-icons/Ionicons`)
2. [x] ~~Remover `favicon.png` e assets web~~ (Removidos)
3. [x] ~~Converter PNGs restantes para WebP~~ (Convertidos: logo_banner, tv_banner)

### Fase 2 - Médio Impacto
4. [x] ~~Remover `react-native-markdown-display` e criar componente simples~~ (Substituído por SimpleMarkdown.tsx)
5. [x] ~~Verificar e habilitar R8/Proguard~~ (Managed workflow - habilitado por padrão no EAS Build)
6. [x] ~~Limpar seções iOS/Web do `app.json`~~ (Removidas seções iOS/Web, adicionado assetBundlePatterns)

### Fase 3 - Baixo Impacto
7. [x] ~~Avaliar substituição de `expo-linear-gradient`~~ (Mantido - necessário para UI de gradientes)
8. [x] ~~Verificar uso de `expo-keep-awake`~~ (Verificado e mantido - usado para manter tela ativa durante streaming)
9. [x] ~~Auditar código para imports não usados~~ (Limpos: SettingsModal, _layout, etc.)
10. [x] ~~Verificar se `withExoPlayerBuffer` está gerando código não usado~~ (Plugin e arquivos removidos)

### Fase 4 - Avançado
11. [ ] Implementar tree-shaking mais agressivo
12. [ ] Considerar usar `react-native-svg` para ícones customizados
13. [ ] Avaliar necessidade de arquiteturas x86 (emuladores vs dispositivos reais)

---

## 🔍 Comandos Úteis

### Analisar tamanho do bundle JavaScript
```bash
npx react-native-bundle-visualizer
```

### Verificar dependências não usadas
```bash
npx depcheck
```

### Analisar APK
```bash
# Android Studio > Build > Analyze APK
# Ou usar bundletool
bundletool build-apks --bundle=app.aab --output=output.apks
```

### Gerar relatório de tamanho
```bash
./gradlew app:dependencies --configuration releaseRuntimeClasspath
```

---

## 📝 Notas Finais

1. **Priorize as otimizações de alto impacto** - @expo/vector-icons sozinho pode economizar 3-5 MB

2. **Teste após cada mudança** - Algumas dependências podem ter side effects inesperados

3. **Considere o público-alvo** - Se o app é apenas para Android TV (arm64), considere remover x86

4. **Monitoramento contínuo** - Configure CI para reportar tamanho do APK em cada build