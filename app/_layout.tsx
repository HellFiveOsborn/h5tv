import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../src/constants/Colors';
import { useEffect, useState } from 'react';
import { checkForUpdate, UpdateInfo } from '../src/services/updateService';
import { UpdateDialog } from '../src/components/UpdateDialog';
import { SettingsModal } from '../src/components/SettingsModal';
import { SettingsService } from '../src/services/settingsService';
import { TouchableOpacity, Text, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Network from 'expo-network';
import * as IntentLauncher from 'expo-intent-launcher';

export default function RootLayout() {
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [dialogVisible, setDialogVisible] = useState(false);
    const [settingsVisible, setSettingsVisible] = useState(false);

    useEffect(() => {
        const init = async () => {
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
            <StatusBar style="light" />
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

            {/* Settings Button Overlay */}
            <View style={{ position: 'absolute', top: 40, right: 20, zIndex: 100 }}>
                <TouchableOpacity onPress={() => setSettingsVisible(true)}>
                    <Ionicons name="settings-outline" size={24} color="white" />
                </TouchableOpacity>
            </View>

            <UpdateDialog
                visible={dialogVisible}
                updateInfo={updateInfo}
                onCancel={() => setDialogVisible(false)}
            />
            <SettingsModal
                visible={settingsVisible}
                onClose={() => setSettingsVisible(false)}
            />
        </>
    );
}
