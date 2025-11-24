import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

interface SidebarProps {
    activeRoute: string;
    onNavigate: (route: string) => void;
}

export const Sidebar = ({ activeRoute, onNavigate }: SidebarProps) => {
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

    const handleNavigate = (route: string) => {
        if (route === 'logout') {
            BackHandler.exitApp();
            return;
        }
        onNavigate(route);
    };

    const menuItems = [
        { icon: 'home', label: 'Início', route: 'home' },
        { icon: 'grid', label: 'Lista de Canais', route: 'channels' },
        { icon: 'settings-outline', label: 'Configurações', route: 'settings' },
        { icon: 'power', label: 'Sair', route: 'logout', color: '#e50914' },
    ];

    return (
        <View style={styles.container}>
            <View style={styles.menuItems}>
                {menuItems.map((item, index) => (
                    <Pressable
                        key={index}
                        onPress={() => handleNavigate(item.route)}
                        onFocus={() => setFocusedIndex(index)}
                        onBlur={() => setFocusedIndex(null)}
                        style={[
                            styles.menuItem,
                            focusedIndex === index && styles.menuItemFocused
                        ]}
                    >
                        <Ionicons
                            name={item.icon as any}
                            size={28}
                            color={item.color || (activeRoute === item.route ? Colors.primary : '#888')}
                        />
                        <Text
                            style={[
                                styles.menuText,
                                activeRoute === item.route && styles.activeText,
                                item.color ? { color: item.color } : null,
                                focusedIndex === index && styles.focusedText
                            ]}
                        >
                            {item.label}
                        </Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 100,
        height: '100%',
        backgroundColor: '#121212',
        borderRightWidth: 1,
        borderRightColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    menuItems: {
        flex: 1,
        justifyContent: 'center',
        gap: 20,
    },
    menuItem: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 15,
        paddingHorizontal: 10,
        borderRadius: 8,
        width: 80,
    },
    menuItemFocused: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        transform: [{ scale: 1.1 }],
    },
    menuText: {
        color: '#888',
        fontSize: 10,
        textAlign: 'center',
        marginTop: 4,
    },
    activeText: {
        color: Colors.primary,
        fontWeight: 'bold',
    },
    focusedText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});
