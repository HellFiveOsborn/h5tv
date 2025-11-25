import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, BackHandler, findNodeHandle, PressableProps, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useFocusArea } from '../constants/FocusContext';

// Extended props for TV navigation (these exist at runtime on Android TV)
interface TVPressableProps extends PressableProps {
    hasTVPreferredFocus?: boolean;
    nextFocusUp?: number;
    nextFocusDown?: number;
    nextFocusLeft?: number;
    nextFocusRight?: number;
}

const TVPressable = Pressable as React.ComponentType<TVPressableProps & React.RefAttributes<View>>;

interface SidebarProps {
    activeRoute: string;
    onNavigate: (route: string) => void;
    contentRef?: React.RefObject<any>;
}

export const Sidebar = ({ activeRoute, onNavigate, contentRef }: SidebarProps) => {
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
    const itemRefs = useRef<(View | null)[]>([]);
    const [nodeHandles, setNodeHandles] = useState<(number | null)[]>([]);
    const { setFocusArea } = useFocusArea();
    const { height: screenHeight } = useWindowDimensions();

    // Determine if screen is small (less than 600px height, like 720p TV)
    const isSmallScreen = screenHeight < 600;

    const menuItems = [
        { icon: 'home', label: 'Início', route: 'home' },
        { icon: 'grid', label: 'Lista de Canais', route: 'channels' },
        { icon: 'settings-outline', label: 'Configurações', route: 'settings' },
        { icon: 'power', label: 'Sair', route: 'logout', color: '#e50914' },
    ];

    useEffect(() => {
        // Delay to ensure refs are mounted
        const timer = setTimeout(() => {
            const handles = itemRefs.current.map(ref => ref ? findNodeHandle(ref) : null);
            setNodeHandles(handles);
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    const handleNavigate = (route: string) => {
        if (route === 'logout') {
            BackHandler.exitApp();
            return;
        }
        onNavigate(route);
    };

    const getContentNodeHandle = (): number | undefined => {
        if (contentRef?.current) {
            const handle = findNodeHandle(contentRef.current);
            return handle ?? undefined;
        }
        return undefined;
    };

    // Dynamic styles based on screen size
    const dynamicStyles = {
        container: {
            width: isSmallScreen ? 80 : 100,
            paddingVertical: isSmallScreen ? 15 : 40,
        },
        menuItems: {
            gap: isSmallScreen ? 8 : 20,
        },
        menuItem: {
            paddingVertical: isSmallScreen ? 8 : 15,
            paddingHorizontal: isSmallScreen ? 6 : 10,
            width: isSmallScreen ? 68 : 80,
        },
        icon: {
            size: isSmallScreen ? 22 : 28,
        },
    };

    return (
        <View style={[styles.container, dynamicStyles.container]}>
            <View style={[styles.menuItems, dynamicStyles.menuItems]}>
                {menuItems.map((item, index) => (
                    <TVPressable
                        key={index}
                        ref={(ref) => { itemRefs.current[index] = ref; }}
                        onPress={() => handleNavigate(item.route)}
                        onFocus={() => {
                            setFocusedIndex(index);
                            setFocusArea('sidebar');
                        }}
                        onBlur={() => setFocusedIndex(null)}
                        style={[
                            styles.menuItem,
                            dynamicStyles.menuItem,
                            focusedIndex === index && styles.menuItemFocused
                        ]}
                        // TV Navigation Props
                        hasTVPreferredFocus={index === 0}
                        nextFocusUp={index > 0 ? nodeHandles[index - 1] ?? undefined : undefined}
                        nextFocusDown={index < menuItems.length - 1 ? nodeHandles[index + 1] ?? undefined : undefined}
                        nextFocusRight={getContentNodeHandle()}
                    >
                        <Ionicons
                            name={item.icon as any}
                            size={dynamicStyles.icon.size}
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
                    </TVPressable>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        height: '100%',
        backgroundColor: '#121212',
        borderRightWidth: 1,
        borderRightColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuItems: {
        flex: 1,
        justifyContent: 'center',
    },
    menuItem: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        borderRadius: 8,
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
