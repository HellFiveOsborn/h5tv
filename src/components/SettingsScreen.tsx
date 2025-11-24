import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, Pressable, Alert, ActivityIndicator, ScrollView, Platform, DevSettings } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { StorageKeys } from '../constants/StorageKeys';

interface SettingRowProps {
    label: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    value: boolean;
    onToggle: (value: boolean) => void;
}

const SettingRow = ({ label, description, icon, value, onToggle }: SettingRowProps) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <Pressable
            style={({ pressed }) => [
                styles.settingItem,
                (pressed || isFocused) && styles.settingItemFocused
            ]}
            onPress={() => onToggle(!value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            focusable={true}
        >
            <View style={styles.settingInfo}>
                <View style={styles.settingLabelContainer}>
                    <Ionicons
                        name={icon}
                        size={20}
                        color={isFocused ? '#fff' : Colors.primary}
                        style={styles.settingIcon}
                    />
                    <Text style={[styles.settingLabel, isFocused && styles.textFocused]}>{label}</Text>
                </View>
                <Text style={[styles.settingDescription, isFocused && styles.textDescriptionFocused]}>
                    {description}
                </Text>
            </View>
            <Switch
                trackColor={{ false: '#3a3a3a', true: 'rgba(0, 255, 136, 0.5)' }}
                thumbColor={value ? Colors.primary : '#b0b0b0'}
                ios_backgroundColor="#3e3e3e"
                onValueChange={onToggle}
                value={value}
            />
        </Pressable>
    );
};

export const SettingsScreen = () => {
    const [startOnBoot, setStartOnBoot] = useState(false);
    const [forceWifi, setForceWifi] = useState(true);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const boot = await AsyncStorage.getItem(StorageKeys.SETTINGS_START_ON_BOOT);
            const wifi = await AsyncStorage.getItem(StorageKeys.SETTINGS_FORCE_WIFI);

            if (boot !== null) setStartOnBoot(boot === 'true');
            if (wifi !== null) setForceWifi(wifi === 'true');
        } catch (e) {
            console.error('Failed to load settings', e);
        } finally {
            setLoading(false);
        }
    };

    const toggleStartOnBoot = async (value: boolean) => {
        setStartOnBoot(value);
        try {
            await AsyncStorage.setItem(StorageKeys.SETTINGS_START_ON_BOOT, String(value));
        } catch (e) {
            console.error('Failed to save startOnBoot', e);
        }
    };

    const toggleForceWifi = async (value: boolean) => {
        setForceWifi(value);
        try {
            await AsyncStorage.setItem(StorageKeys.SETTINGS_FORCE_WIFI, String(value));
        } catch (e) {
            console.error('Failed to save forceWifi', e);
        }
    };

    const restartApp = () => {
        if (__DEV__) {
            // In development, we can try to reload
            try {
                // @ts-ignore - DevSettings is available in React Native
                const { DevSettings } = require('react-native');
                DevSettings.reload();
            } catch (e) {
                Alert.alert('Reiniciar', 'Por favor, reinicie o aplicativo manualmente para aplicar as alterações.');
            }
        } else {
            // In production/Expo Go without updates configured, we can't easily force a full cold restart programmatically
            // Best effort is to alert the user.
            Alert.alert('Reiniciar', 'Por favor, feche e abra o aplicativo novamente para que todas as alterações tenham efeito.');
        }
    };

    const [clearCacheFocused, setClearCacheFocused] = useState(false);

    const clearCache = async () => {
        Alert.alert(
            'Limpar Cache',
            'Tem certeza que deseja limpar todo o cache? Isso apagará dados salvos temporariamente e reiniciará o aplicativo.',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Limpar e Reiniciar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            // Clear all keys from AsyncStorage
                            await AsyncStorage.clear();

                            // Restore settings preferences immediately so user doesn't lose them
                            await AsyncStorage.setItem(StorageKeys.SETTINGS_START_ON_BOOT, String(startOnBoot));
                            await AsyncStorage.setItem(StorageKeys.SETTINGS_FORCE_WIFI, String(forceWifi));

                            // Give a small delay to ensure UI updates
                            setTimeout(() => {
                                setLoading(false);
                                restartApp();
                            }, 500);
                        } catch (e) {
                            setLoading(false);
                            Alert.alert('Erro', 'Falha ao limpar cache.');
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Processando...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.header}>
                <Ionicons name="settings-sharp" size={32} color="#fff" style={styles.headerIcon} />
                <Text style={styles.headerTitle}>Configurações</Text>
            </View>

            <View style={styles.sectionTitleContainer}>
                <Text style={styles.sectionTitle}>Geral</Text>
            </View>

            <View style={styles.section}>
                <SettingRow
                    label="Iniciar com o sistema"
                    description="Abrir automaticamente ao ligar o dispositivo (Requer permissão no Android TV)."
                    icon="power"
                    value={startOnBoot}
                    onToggle={toggleStartOnBoot}
                />

                <View style={styles.separator} />

                <SettingRow
                    label="Forçar Wi-Fi"
                    description="Verificar e alertar sobre conexão Wi-Fi ao abrir o aplicativo."
                    icon="wifi"
                    value={forceWifi}
                    onToggle={toggleForceWifi}
                />
            </View>

            <View style={styles.sectionTitleContainer}>
                <Text style={styles.sectionTitle}>Armazenamento</Text>
            </View>

            <View style={styles.section}>
                <Pressable
                    style={({ pressed }) => [
                        styles.clearCacheButton,
                        pressed && styles.clearCacheButtonPressed,
                        clearCacheFocused && styles.clearCacheButtonFocused
                    ]}
                    onPress={clearCache}
                    onFocus={() => setClearCacheFocused(true)}
                    onBlur={() => setClearCacheFocused(false)}
                    focusable={true}
                >
                    <View style={styles.buttonContent}>
                        <Ionicons name="trash-bin-outline" size={22} color={clearCacheFocused ? "#ff8888" : "#ff4444"} style={styles.buttonIcon} />
                        <View>
                            <Text style={[styles.clearCacheText, clearCacheFocused && styles.textFocused]}>Limpar Cache</Text>
                            <Text style={[styles.clearCacheSubtext, clearCacheFocused && styles.textDescriptionFocused]}>Apagar dados temporários e recarregar</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={clearCacheFocused ? "#fff" : "#666"} />
                </Pressable>
            </View>

            <View style={styles.footer}>
                <Text style={styles.appName}>H5TV</Text>
                <Text style={styles.versionText}>Versão 1.0.0</Text>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    contentContainer: {
        padding: 40,
        paddingBottom: 80,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    loadingText: {
        color: '#888',
        marginTop: 10,
        fontSize: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    headerIcon: {
        marginRight: 15,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 32,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    sectionTitleContainer: {
        marginBottom: 10,
        marginTop: 10,
    },
    sectionTitle: {
        color: '#888',
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginLeft: 5,
    },
    section: {
        backgroundColor: '#1a1a1a',
        borderRadius: 16,
        padding: 5,
        marginBottom: 30,
        borderWidth: 1,
        borderColor: '#333',
    },
    settingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        borderRadius: 12,
    },
    settingItemFocused: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        transform: [{ scale: 1.01 }],
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    textFocused: {
        color: '#fff',
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    textDescriptionFocused: {
        color: '#ddd',
    },
    settingInfo: {
        flex: 1,
        paddingRight: 20,
    },
    settingLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    settingIcon: {
        marginRight: 10,
    },
    settingLabel: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    settingDescription: {
        color: '#aaa',
        fontSize: 13,
        lineHeight: 18,
        paddingLeft: 30,
    },
    separator: {
        height: 1,
        backgroundColor: '#333',
        marginLeft: 45, // Indent separator
        marginRight: 15,
    },
    clearCacheButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
        borderRadius: 12,
    },
    clearCacheButtonPressed: {
        backgroundColor: 'rgba(255, 68, 68, 0.1)',
    },
    clearCacheButtonFocused: {
        backgroundColor: 'rgba(255, 68, 68, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255, 68, 68, 0.3)',
        transform: [{ scale: 1.01 }],
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    buttonIcon: {
        marginRight: 15,
    },
    clearCacheText: {
        color: '#ff4444', // Red color for destructive action
        fontSize: 17,
        fontWeight: '600',
    },
    clearCacheSubtext: {
        color: '#666',
        fontSize: 12,
        marginTop: 2,
    },
    footer: {
        alignItems: 'center',
        marginTop: 20,
        opacity: 0.5,
    },
    appName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    versionText: {
        color: '#666',
        fontSize: 12,
    }
});
