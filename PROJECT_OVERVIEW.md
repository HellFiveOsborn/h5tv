# Overview do Projeto H5TV

Este documento fornece uma visão geral técnica e funcional do projeto **H5TV**, um aplicativo de streaming de TV ao vivo desenvolvido com React Native e Expo, otimizado para **Android TV** e dispositivos **Android 6+**.

## 🛠 Stack Tecnológica

- **Framework:** React Native (via Expo SDK 52)
- **Linguagem:** TypeScript
- **Roteamento:** Expo Router
- **Player de Vídeo:** `react-native-video` (Player Nativo com ExoPlayer)
- **Interceptação de Streams:** WebView nativo (Kotlin) com `shouldInterceptRequest`
- **Estilização:** StyleSheet padrão do React Native
- **Gerenciamento de Estado:** React Hooks (`useState`, `useEffect`, `useRef`) e Context API (`FocusContext`)
- **Armazenamento Local:** `@react-native-async-storage/async-storage`
- **Ícones:** `@expo/vector-icons`
- **Plataforma Suportada:** Android 6+ (API 23+), Android TV

## 📂 Estrutura de Diretórios

A estrutura do projeto segue o padrão do Expo Router:

- **`app/`**: Contém as rotas da aplicação.
  - `index.tsx`: Tela inicial (Home), contendo o slider de jogos, lista de canais e sidebar.
  - `stream.tsx`: Tela de reprodução (Player), gerencia a exibição do vídeo e controles.
  - `_layout.tsx`: Configuração global do layout e provedores de contexto.

- **`src/`**: Código fonte principal.
  - **`components/`**: Componentes de UI reutilizáveis.
    - `Sidebar.tsx`: Menu lateral de navegação.
    - `ChannelList.tsx`: Lista de canais organizados por categoria.
    - `GameSlider.tsx`: Carrossel de jogos de futebol com informações em tempo real.
    - `player/`: Componentes específicos do player de vídeo.
      - `StreamWebView.tsx`: Wrapper do componente nativo de interceptação.
      - `NativeStreamWebView.tsx`: Componente React Native para o WebView Kotlin nativo.
      - `PlayerOverlay.tsx`: Interface de controles do player.
      - `ConnectionInfo.tsx`: Indicador de status de conexão.
    - `SettingsScreen.tsx`: Tela de configurações.
    - `UpdateDialog.tsx`: Modal de atualização do aplicativo.
  - **`services/`**: Lógica de negócios e comunicação com APIs.
    - `api.ts`: Configuração base do Axios ou fetch.
    - `channelService.ts`: Busca e tratamento da lista de canais.
    - `guideService.ts`: Busca de informações do EPG (Guia de Programação).
    - `timeService.ts`: Sincronização de horário com servidor externo (`worldtimeapi.org`).
    - `updateService.ts`: Lógica de verificação e download de atualizações.
  - **`utils/`**: Funções utilitárias.
    - `streamInterceptor.ts`: Constantes e funções de detecção de streams (m3u8/mpd), bloqueio de ads, e utilidades.
  - **`constants/`**: Constantes globais (Cores, Chaves de Storage).
  - **`hooks/`**: Hooks customizados.
- **`plugins/`**: Plugins Expo para configuração nativa.
  - `withStreamInterceptor.js`: Gera o código Kotlin para o WebView customizado com interceptação de rede.

## 🚀 Principais Funcionalidades

### 1. Tela Inicial (Home)
- **Navegação TV:** Implementação robusta de foco para controle remoto (D-Pad), utilizando `TVFocusable` e gerenciamento manual de referências (`ref`).
- **Game Slider:** Exibe jogos de hoje/amanhã com placares e horários.
- **Lista de Canais:** Exibição horizontal e vertical de canais com logos e suporte a categorias.
- **Busca:** Funcionalidade de busca de canais e jogos.

### 2. Player de Vídeo (Stream)
- **Interceptação de Rede Nativa:** O app usa um WebView customizado (Kotlin) que monitora TODAS as requisições de rede via `shouldInterceptRequest`. Quando detecta uma URL de stream (`.m3u8`, `.mpd`), captura a URL e headers para reprodução no player nativo.
- **Fluxo de Reprodução:**
  1. Canal URL → StreamWebView (WebView Kotlin)
  2. shouldInterceptRequest monitora requisições
  3. Detecta URL de stream (m3u8/mpd)
  4. Callback para React Native com URL + headers
  5. React Native Video (ExoPlayer) reproduz o stream
- **Sistema de AdBlock Integrado:**
  - Bloqueio de domínios de ads em `shouldInterceptRequest`
  - Injeção de CSS para esconder elementos de ads
  - Bloqueio de popups e `window.open`
- **Overlay de Controles:** Interface sobreposta com informações do programa atual, tempo decorrido e lista de canais rápida (Zapping).
- **EPG em Tempo Real:** Exibe o programa atual e o próximo, baseado no horário sincronizado.

### 3. Sistema de Atualização
- Verifica periodicamente ou manualmente se há uma nova versão do app disponível no GitHub.
- Realiza o download e solicita a instalação do APK.

### 4. Sincronização de Horário
- Para garantir a precisão do EPG, o app sincroniza o relógio interno com um servidor NTP/API externo ao iniciar.

## ⚙️ Scripts e Configuração

- **`package.json`**: Define as dependências e scripts de build (`android`, `ios`, `web`).
- **`app.json`**: Configurações do Expo (nome, slug, versão, orientação, etc.).
- **`scripts/`**: Scripts auxiliares, como `build-release.ps1` para automação de builds de release.

## 📝 Notas Adicionais

- O projeto está configurado exclusivamente para **Android** (Android TV e dispositivos móveis Android 6+).
- Tratamento especial para eventos de teclado (controle remoto) e foco de UI para Android TV.
- A pasta `releases/` é utilizada para armazenar os APKs gerados.
- O sistema de interceptação de streams usa código nativo Kotlin gerado pelo plugin `withStreamInterceptor.js`.

## 🏗️ Arquitetura de Interceptação de Streams

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Native                              │
├─────────────────────────────────────────────────────────────────┤
│  StreamWebView.tsx  →  NativeStreamWebView.tsx                  │
│         │                       │                                │
│         └───────────────────────┼────────────────────────────────│
│                                 ↓                                │
├─────────────────────────────────────────────────────────────────┤
│                     Kotlin (Android Nativo)                      │
├─────────────────────────────────────────────────────────────────┤
│  StreamInterceptorWebView.kt                                     │
│  ├── shouldInterceptRequest() ──→ Monitora TODAS requisições    │
│  │   ├── isAdDomain() ──────────→ Bloqueia ads                  │
│  │   └── isVideoUrl() ──────────→ Detecta m3u8/mpd             │
│  │                                     │                         │
│  │                                     ↓                         │
│  │                         onStreamDetected (callback)           │
│  │                                     │                         │
│  └── onPageFinished() ──────────→ Injeta CSS AdBlock            │
│                                        │                         │
├────────────────────────────────────────┼────────────────────────┤
│                                        ↓                         │
│                          React Native Video                      │
│                        (ExoPlayer nativo)                        │
└─────────────────────────────────────────────────────────────────┘
```
