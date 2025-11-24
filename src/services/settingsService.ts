import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
    START_ON_BOOT: 'START_ON_BOOT',
    FORCE_WIFI: 'FORCE_WIFI',
};

export const SettingsService = {
    getStartOnBoot: async (): Promise<boolean> => {
        const value = await AsyncStorage.getItem(KEYS.START_ON_BOOT);
        return value === 'true';
    },

    setStartOnBoot: async (value: boolean) => {
        await AsyncStorage.setItem(KEYS.START_ON_BOOT, String(value));
    },

    getForceWifi: async (): Promise<boolean> => {
        const value = await AsyncStorage.getItem(KEYS.FORCE_WIFI);
        return value === 'true';
    },

    setForceWifi: async (value: boolean) => {
        await AsyncStorage.setItem(KEYS.FORCE_WIFI, String(value));
    },
};
