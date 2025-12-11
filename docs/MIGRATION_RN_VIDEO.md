# Plano de Migração: expo-video → react-native-video

## Visão Geral

Este documento descreve a migração do player `expo-video` para `react-native-video`, uma biblioteca mais madura com melhor suporte para streaming HLS/DASH e Android TV.

## Motivação

| Aspecto | expo-video | react-native-video |
|---------|------------|-------------------|
| Maturidade | Novo (SDK 52+) | Estabelecido (7+ anos) |
| Controle de Buffer | Limitado | Completo via ExoPlayer |
| Android TV | Básico | Excelente |
| Comunidade | Pequena | Grande (10k+ stars) |
| Headers HLS | Problemático | Suporte nativo |
| Eventos | Limitados | Completos |

## Pré-requisitos

- **Expo SDK:** 52+ com prebuild (não funciona com Expo Go)
- **react-native-video versão:** ^6.x

## Diferenças de API

### expo-video (Atual)

```tsx
import { useVideoPlayer, VideoView } from 'expo-video';

// Hook pattern - player separado do componente
const player = useVideoPlayer(url, player => {
    player.loop = true;
    player.play();
});

// Status via event listeners
useEffect(() => {
    const sub = player.addListener('statusChange', (status) => {
        console.log(status);
    });
    return () => sub?.remove();
}, [player]);

<VideoView
    player={player}
    style={styles.video}
    contentFit="contain"
    nativeControls={false}
/>
```

### react-native-video (Novo)

```tsx
import Video, { ResizeMode, VideoRef, OnBufferData, OnErrorData, OnLoadData } from 'react-native-video';

// Referência para controle imperativo
const videoRef = useRef<VideoRef>(null);

// Callbacks diretos no componente
const onBuffer = (data: OnBufferData) => {
    console.log('Buffering:', data.isBuffering);
};

const onError = (error: OnErrorData) => {
    console.log('Error:', error);
};

const onLoad = (data: OnLoadData) => {
    console.log('Loaded, duration:', data.duration);
};

<Video
    ref={videoRef}
    source={{
        uri: url,
        headers: headers,
        type: 'm3u8', // Força HLS
    }}
    style={styles.video}
    resizeMode={ResizeMode.CONTAIN}
    controls={false}
    repeat={true}
    paused={false}
    bufferConfig={{
        minBufferMs: 15000,
        maxBufferMs: 50000,
        bufferForPlaybackMs: 2500,
        bufferForPlaybackAfterRebufferMs: 5000,
    }}
    onBuffer={onBuffer}
    onError={onError}
    onLoad={onLoad}
/>
```

## Mapeamento de Props

| expo-video | react-native-video | Descrição |
|------------|-------------------|-----------|
| `player.loop = true` | `repeat={true}` | Loop do vídeo |
| `player.play()` | `paused={false}` | Auto-play |
| `player.pause()` | `paused={true}` | Pausar |
| `contentFit="contain"` | `resizeMode={ResizeMode.CONTAIN}` | Ajuste de tela |
| `nativeControls={false}` | `controls={false}` | Controles nativos |
| `player.volume = 1.0` | `volume={1.0}` | Volume |
| `player.muted = false` | `muted={false}` | Mudo |
| `statusChange` listener | `onBuffer`, `onError`, `onLoad` | Eventos |

## Configuração de Buffer (ExoPlayer)

Uma das maiores vantagens do `react-native-video` é o controle granular de buffer:

```tsx
bufferConfig={{
    // Quantidade mínima de buffer antes de pausar (ms)
    minBufferMs: 15000,
    
    // Quantidade máxima de buffer (ms)
    maxBufferMs: 50000,
    
    // Buffer necessário para iniciar playback (ms)
    bufferForPlaybackMs: 2500,
    
    // Buffer necessário após rebuffering (ms)
    bufferForPlaybackAfterRebufferMs: 5000,
    
    // Cache de vídeo (bytes, 0 = desabilitado)
    cacheSizeMB: 0,
}}
```

Para IPTV/HLS ao vivo, configuração recomendada:

```tsx
bufferConfig={{
    minBufferMs: 10000,        // 10s mínimo
    maxBufferMs: 30000,        // 30s máximo (live não precisa muito)
    bufferForPlaybackMs: 2000, // Inicia rápido
    bufferForPlaybackAfterRebufferMs: 3000,
}}
```

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `package.json` | Remover expo-video, adicionar react-native-video |
| `app.json` | Remover expo-video do plugins |
| `app/stream.tsx` | Migrar para nova API |
| `PROJECT_OVERVIEW.md` | Atualizar documentação |
| `docs/MIGRATION_EXPO_VIDEO.md` | Deletar ou arquivar |

## Passos de Implementação

### 1. Atualizar Dependências

```bash
npm uninstall expo-video
npm install react-native-video@^6.0.0
```

### 2. Remover plugin do app.json

```json
{
  "plugins": [
    "expo-router",
    "./plugins/withBootReceiver.js",
    "./plugins/withAbiSplits.js",
    "./plugins/withStreamInterceptor.js"
    // Remover: "expo-video"
  ]
}
```

### 3. Migrar app/stream.tsx

```tsx
// ANTES
import { useVideoPlayer, VideoView } from 'expo-video';

function StreamPlayer({ url, headers }: { url: string, headers: any }) {
    const player = useVideoPlayer(url, player => {
        player.loop = true;
        player.play();
    });

    return (
        <VideoView
            player={player}
            style={styles.video}
            contentFit="contain"
            nativeControls={false}
        />
    );
}

// DEPOIS
import Video, { ResizeMode, VideoRef, OnBufferData, OnErrorData } from 'react-native-video';

function StreamPlayer({ url, headers }: { url: string, headers: any }) {
    const videoRef = useRef<VideoRef>(null);
    const [isBuffering, setIsBuffering] = useState(false);

    const onBuffer = useCallback((data: OnBufferData) => {
        setIsBuffering(data.isBuffering);
    }, []);

    const onError = useCallback((error: OnErrorData) => {
        console.log('[Video] Error:', error.error);
    }, []);

    return (
        <Video
            ref={videoRef}
            source={{
                uri: url,
                headers: headers,
                type: 'm3u8',
            }}
            style={styles.video}
            resizeMode={ResizeMode.CONTAIN}
            controls={false}
            repeat={true}
            paused={false}
            bufferConfig={{
                minBufferMs: 10000,
                maxBufferMs: 30000,
                bufferForPlaybackMs: 2000,
                bufferForPlaybackAfterRebufferMs: 3000,
            }}
            onBuffer={onBuffer}
            onError={onError}
        />
    );
}
```

### 4. Rebuild do Projeto

```bash
npx expo prebuild --clean
npx expo run:android
# OU
.\scripts\build-release.ps1 -Clean
```

## Headers HTTP Personalizados

O `react-native-video` suporta headers nativamente:

```tsx
<Video
    source={{
        uri: 'https://stream.example.com/live.m3u8',
        headers: {
            'User-Agent': 'H5TV/1.3.0',
            'Referer': 'https://example.com',
            'Authorization': 'Bearer token123',
        },
        type: 'm3u8', // Força detecção HLS
    }}
/>
```

## Recursos Avançados

### DRM (Widevine/PlayReady)

```tsx
<Video
    source={{ uri: drmStreamUrl }}
    drm={{
        type: 'widevine',
        licenseServer: 'https://license.example.com',
        headers: {
            'X-Custom-Header': 'value',
        },
    }}
/>
```

### Text Tracks (Legendas)

```tsx
<Video
    source={{ uri: url }}
    selectedTextTrack={{
        type: 'language',
        value: 'pt',
    }}
/>
```

### Audio Tracks

```tsx
<Video
    source={{ uri: url }}
    selectedAudioTrack={{
        type: 'language',
        value: 'pt',
    }}
/>
```

## Considerações para Android TV

- O `react-native-video` tem melhor integração com controles de mídia
- Suporte a Picture-in-Picture (PiP) nativo
- Melhor handling de eventos de foco/tecla
- Mais estável em dispositivos de baixa especificação

## Eventos Disponíveis

| Evento | Descrição |
|--------|-----------|
| `onLoad` | Vídeo carregado, contém duração |
| `onLoadStart` | Início do carregamento |
| `onBuffer` | Estado de buffering mudou |
| `onError` | Erro ocorreu |
| `onProgress` | Progresso de playback |
| `onEnd` | Vídeo terminou |
| `onSeek` | Seek completado |
| `onPlaybackRateChange` | Taxa de playback mudou |
| `onAudioBecomingNoisy` | Fones desconectados |
| `onPictureInPictureStatusChanged` | PiP ativado/desativado |

## Rollback

Se houver problemas, reverter para expo-video:

```bash
npm uninstall react-native-video
npm install expo-video@^3.0.14
# Restaurar plugin no app.json
npx expo prebuild --clean
```

## Testes Necessários

- [ ] Reprodução de stream HLS (.m3u8)
- [ ] Headers de autenticação sendo enviados
- [ ] Loop de vídeo funcionando
- [ ] Overlay de controles aparecendo/desaparecendo
- [ ] Navegação por controle remoto (Android TV)
- [ ] Troca de canal (channel switch)
- [ ] Troca de fonte (source switch)
- [ ] Buffer não excessivo (memória)
- [ ] Recuperação de buffering

## Referências

- [react-native-video GitHub](https://github.com/react-native-video/react-native-video)
- [Documentação v6](https://react-native-video.github.io/react-native-video/)
- [ExoPlayer Buffer Config](https://developer.android.com/reference/com/google/android/exoplayer2/DefaultLoadControl)