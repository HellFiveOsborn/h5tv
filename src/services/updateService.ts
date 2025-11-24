import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

const GITHUB_REPO = 'HellFiveOsborn/h5tv';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export interface UpdateInfo {
    version: string;
    downloadUrl: string;
    releaseNotes: string;
}

export const checkForUpdate = async (): Promise<UpdateInfo | null> => {
    if (Platform.OS !== 'android') return null;

    try {
        const response = await fetch(GITHUB_API_URL);
        if (!response.ok) return null;

        const data = await response.json();
        const latestVersion = data.tag_name.replace(/^v/, '');
        const currentVersion = Application.nativeApplicationVersion || '1.0.0';

        if (compareVersions(latestVersion, currentVersion) > 0) {
            const apkAsset = data.assets.find((asset: any) => asset.name.endsWith('.apk'));
            if (apkAsset) {
                return {
                    version: latestVersion,
                    downloadUrl: apkAsset.browser_download_url,
                    releaseNotes: data.body,
                };
            }
        }
    } catch (error) {
        console.error('Error checking for update:', error);
    }
    return null;
};

export const downloadUpdate = async (url: string, onProgress?: (progress: number) => void): Promise<string | null> => {
    try {
        const callback = (downloadProgress: FileSystem.DownloadProgressData) => {
            const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
            if (onProgress) onProgress(progress);
        };

        const downloadResumable = FileSystem.createDownloadResumable(
            url,
            FileSystem.documentDirectory + 'update.apk',
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
        const contentUri = await FileSystem.getContentUriAsync(fileUri);
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
