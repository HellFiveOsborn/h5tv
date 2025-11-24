import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { SettingsService } from '../services/settingsService';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Network from 'expo-network';
import { Platform } from 'react-native';

interface SettingsModalProps {
    visible: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
    const [startOnBoot, setStartOnBoot] = useState(false);
    const [forceWifi, setForceWifi] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setStartOnBoot(await SettingsService.getStartOnBoot());
        setForceWifi(await SettingsService.getForceWifi());
    };

    const toggleStartOnBoot = async (value: boolean) => {
        setStartOnBoot(value);
        await SettingsService.setStartOnBoot(value);
    };

    const toggleForceWifi = async (value: boolean) => {
        setForceWifi(value);
        await SettingsService.setForceWifi(value);
        if (value) {
            checkWifi();
        }
    };

    const checkWifi = async () => {
        const state = await Network.getNetworkStateAsync();
        if (!state.isConnected || state.type !== Network.NetworkStateType.WIFI) {
            if (Platform.OS === 'android') {
                IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.WIFI_SETTINGS);
            }
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.overlay}>
                <View style={styles.dialog}>
                    <Text style={styles.title}>Configurações</Text>

                    <View style={styles.settingRow}>
                        <Text style={styles.settingText}>Iniciar com o Sistema</Text>
                        <Switch value={startOnBoot} onValueChange={toggleStartOnBoot} />
                    </View>
                    <Text style={styles.description}>
                        Inicia o aplicativo automaticamente ao ligar o dispositivo (Requer permissão).
                    </Text>

                    <View style={styles.divider} />

                    <View style={styles.settingRow}>
                        <Text style={styles.settingText}>Forçar Wi-Fi Ligado</Text>
                        <Switch value={forceWifi} onValueChange={toggleForceWifi} />
                    </View>
                    <Text style={styles.description}>
                        Verifica se o Wi-Fi está ligado ao iniciar e solicita ativação.
                    </Text>

                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeButtonText}>Fechar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dialog: {
        width: '80%',
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        elevation: 5,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#333',
        textAlign: 'center',
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 5,
    },
    settingText: {
        fontSize: 18,
        color: '#333',
    },
    description: {
        fontSize: 12,
        color: '#666',
        marginBottom: 15,
    },
    divider: {
        height: 1,
        backgroundColor: '#e0e0e0',
        marginVertical: 10,
    },
    closeButton: {
        marginTop: 20,
        backgroundColor: '#007AFF',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    closeButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
