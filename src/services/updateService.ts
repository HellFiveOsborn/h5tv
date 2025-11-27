import { createDownloadResumable, getContentUriAsync, documentDirectory } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';
import { Platform, NativeModules } from 'react-native';

const GITHUB_REPO = 'HellFiveOsborn/h5tv';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

// Arquiteturas suportadas
type CpuArchitecture = 'arm64-v8a' | 'armeabi-v7a' | 'x86_64' | 'x86' | 'universal';

export interface UpdateInfo {
    version: string;
    downloadUrl: string;
    releaseNotes: string;
    apkSize?: number;
    architecture?: CpuArchitecture;
}

export interface ReleaseAsset {
    name: string;
    browser_download_url: string;
    size: number;
    content_type: string;
}

/**
 * Detecta a arquitetura do CPU do dispositivo
 */
export const getDeviceArchitecture = (): CpuArchitecture => {
    try {
        // Tentar obter a arquitetura via NativeModules
        const { PlatformConstants } = NativeModules;

        if (PlatformConstants) {
            // Em dispositivos Android, podemos verificar as ABIs suportadas
            const supportedAbis = PlatformConstants.Fingerprint || '';
            const reactNativeArch = PlatformConstants.reactNativeVersion?.arch;

            // Verificar arquitetura baseada em propriedades do sistema
            if (reactNativeArch) {
                if (reactNativeArch.includes('arm64')) return 'arm64-v8a';
                if (reactNativeArch.includes('arm')) return 'armeabi-v7a';
                if (reactNativeArch.includes('x86_64')) return 'x86_64';
                if (reactNativeArch.includes('x86')) return 'x86';
            }
        }

        // Fallback: verificar via propriedades do processo
        // Em React Native, podemos tentar inferir pela arquitetura do Hermes/JSC
        if (Platform.OS === 'android') {
            // A maioria dos dispositivos Android modernos são ARM64
            // TVs Android geralmente são ARM ou x86
            const isTV = Platform.isTV;

            // Para TVs, tentar detectar via outras heurísticas
            if (isTV) {
                // Muitas TV boxes chinesas usam arquiteturas variadas
                // Retornar universal como fallback seguro para TVs
                console.log('[UpdateService] TV detectada, usando arquitetura universal como fallback');
            }

            // Verificar se é 64-bit baseado em heurísticas
            // A maioria dos dispositivos Android lançados após 2015 são 64-bit
            return 'arm64-v8a';
        }

        return 'universal';
    } catch (error) {
        console.error('[UpdateService] Erro ao detectar arquitetura:', error);
        return 'universal';
    }
};

/**
 * Busca o APK mais apropriado para a arquitetura do dispositivo
 */
const findBestApkForDevice = (assets: ReleaseAsset[], version: string): ReleaseAsset | null => {
    const deviceArch = getDeviceArchitecture();
    console.log(`[UpdateService] Arquitetura do dispositivo: ${deviceArch}`);

    // Padrão de nome esperado: H5TV-v{version}-{arch}.apk
    const archPatterns: Record<CpuArchitecture, string[]> = {
        'arm64-v8a': [`H5TV-v${version}-arm64-v8a.apk`, 'arm64-v8a', 'arm64'],
        'armeabi-v7a': [`H5TV-v${version}-armeabi-v7a.apk`, 'armeabi-v7a', 'armeabi', 'arm'],
        'x86_64': [`H5TV-v${version}-x86_64.apk`, 'x86_64'],
        'x86': [`H5TV-v${version}-x86.apk`, 'x86'],
        'universal': [`H5TV-v${version}-universal.apk`, 'universal'],
    };

    // 1. Primeiro, tentar encontrar o APK específico para a arquitetura
    const patterns = archPatterns[deviceArch] || [];
    for (const pattern of patterns) {
        const specificApk = assets.find(asset =>
            asset.name.toLowerCase().includes(pattern.toLowerCase()) &&
            asset.content_type === 'application/vnd.android.package-archive'
        );
        if (specificApk) {
            console.log(`[UpdateService] APK específico encontrado: ${specificApk.name}`);
            return specificApk;
        }
    }

    // 2. Fallback: buscar APK universal
    const universalApk = assets.find(asset =>
        asset.name.toLowerCase().includes('universal') &&
        asset.content_type === 'application/vnd.android.package-archive'
    );
    if (universalApk) {
        console.log(`[UpdateService] Usando APK universal: ${universalApk.name}`);
        return universalApk;
    }

    // 3. Último fallback: qualquer APK disponível
    const anyApk = assets.find(asset =>
        asset.content_type === 'application/vnd.android.package-archive' ||
        asset.name.toLowerCase().endsWith('.apk')
    );
    if (anyApk) {
        console.log(`[UpdateService] Usando APK disponível: ${anyApk.name}`);
        return anyApk;
    }

    return null;
};

/**
 * Extrai a arquitetura do nome do APK
 */
const getArchFromApkName = (name: string): CpuArchitecture => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('arm64-v8a') || lowerName.includes('arm64')) return 'arm64-v8a';
    if (lowerName.includes('armeabi-v7a') || lowerName.includes('armeabi')) return 'armeabi-v7a';
    if (lowerName.includes('x86_64')) return 'x86_64';
    if (lowerName.includes('x86')) return 'x86';
    return 'universal';
};

export const checkForUpdate = async (): Promise<UpdateInfo | null> => {
    if (Platform.OS !== 'android') return null;

    try {
        console.log('[UpdateService] Verificando atualizações...');
        const response = await fetch(GITHUB_API_URL, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'H5TV-App'
            }
        });

        if (!response.ok) {
            console.log(`[UpdateService] Erro na API do GitHub: ${response.status}`);
            return null;
        }

        const data = await response.json();
        const latestVersion = data.tag_name.replace(/^v/, '');
        const currentVersion = Constants.expoConfig?.version || '1.0.0';

        console.log(`[UpdateService] Versão atual: ${currentVersion}, Última: ${latestVersion}`);

        if (compareVersions(latestVersion, currentVersion) > 0) {
            const apkAsset = findBestApkForDevice(data.assets, latestVersion);

            if (apkAsset) {
                const architecture = getArchFromApkName(apkAsset.name);
                console.log(`[UpdateService] Atualização disponível: ${apkAsset.name} (${Math.round(apkAsset.size / 1024 / 1024)}MB)`);

                return {
                    version: latestVersion,
                    downloadUrl: apkAsset.browser_download_url,
                    releaseNotes: data.body || '',
                    apkSize: apkAsset.size,
                    architecture,
                };
            } else {
                console.log('[UpdateService] Nenhum APK encontrado na release');
            }
        } else {
            console.log('[UpdateService] App está atualizado');
        }
    } catch (error) {
        console.error('[UpdateService] Erro ao verificar atualização:', error);
    }
    return null;
};

export const downloadUpdate = async (url: string, onProgress?: (progress: number) => void): Promise<string | null> => {
    try {
        const callback = (downloadProgress: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
            const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
            if (onProgress) onProgress(progress);
        };

        const downloadResumable = createDownloadResumable(
            url,
            (documentDirectory || '') + 'update.apk',
            {},
            callback
        );

        const result = await downloadResumable.downloadAsync();
        return result?.uri || null;
    } catch (error) {
        console.error('Error downloading update:', error);
        return null;
    }
};

export const installUpdate = async (fileUri: string) => {
    try {
        const contentUri = await getContentUriAsync(fileUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: contentUri,
            flags: 1,
            type: 'application/vnd.android.package-archive',
        });
    } catch (error) {
        console.error('Error installing update:', error);
    }
};

const compareVersions = (v1: string, v2: string): number => {
    const v1Parts = v1.split('.').map(Number);
    const v2Parts = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const p1 = v1Parts[i] || 0;
        const p2 = v2Parts[i] || 0;
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }
    return 0;
};
