import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { Colors } from '../src/constants/Colors';
import { useEffect, useState } from 'react';
import { checkForUpdate, UpdateInfo } from '../src/services/updateService';
import { UpdateDialog } from '../src/components/UpdateDialog';
import { SettingsModal } from '../src/components/SettingsModal';
import { SettingsService } from '../src/services/settingsService';
import { TouchableOpacity, Text, View, Platform, StatusBar as RNStatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Network from 'expo-network';
import * as IntentLauncher from 'expo-intent-launcher';
import * as NavigationBar from 'expo-navigation-bar';

export default function RootLayout() {
    useKeepAwake();
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [dialogVisible, setDialogVisible] = useState(false);
    const [settingsVisible, setSettingsVisible] = useState(false);

    useEffect(() => {
        const init = async () => {
            // Hide status bar for full screen mode
            if (Platform.OS === 'android') {
                RNStatusBar.setHidden(true);
                RNStatusBar.setTranslucent(true);
                // Hide navigation bar on Android
                NavigationBar.setVisibilityAsync('hidden');
            }

            // Check for updates
            const info = await checkForUpdate();
            if (info) {
                setUpdateInfo(info);
                setDialogVisible(true);
            }

            // Check Force Wi-Fi
            const forceWifi = await SettingsService.getForceWifi();
            if (forceWifi) {
                const state = await Network.getNetworkStateAsync();
                if (!state.isConnected || state.type !== Network.NetworkStateType.WIFI) {
                    if (Platform.OS === 'android') {
                        IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.WIFI_SETTINGS);
                    }
                }
            }
        };
        init();
    }, []);

    return (
        <>
            <StatusBar style="light" hidden={true} />
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: {
                        backgroundColor: Colors.background,
                    },
                }}
            >
                <Stack.Screen name="index" />
            </Stack>

            <UpdateDialog
                visible={dialogVisible}
                updateInfo={updateInfo}
                onCancel={() => setDialogVisible(false)}
            />
        </>
    );
}
