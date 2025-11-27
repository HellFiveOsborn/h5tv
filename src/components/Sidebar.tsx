import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, BackHandler, findNodeHandle, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useFocusArea } from '../constants/FocusContext';
import { TVFocusable, TVFocusableRef, useTVFocusableGroup } from './TVFocusable';

export interface SidebarRef {
    getFirstItemNodeHandle: () => number | null;
    focusFirstItem: () => void;
}

// Static ID for focus navigation
export const SIDEBAR_FIRST_ITEM_ID = 'sidebar-first-item';

interface SidebarProps {
    activeRoute: string;
    onNavigate: (route: string) => void;
    contentRef?: React.RefObject<any>;
}

export const Sidebar = forwardRef<SidebarRef, SidebarProps>(({ activeRoute, onNavigate, contentRef }, ref) => {
    const { setFocusArea } = useFocusArea();
    const { height: screenHeight } = useWindowDimensions();

    const menuItems = [
        { icon: 'home', label: 'Início', route: 'home' },
        { icon: 'grid', label: 'Lista de Canais', route: 'channels' },
        { icon: 'settings-outline', label: 'Configurações', route: 'settings' },
        { icon: 'power', label: 'Sair', route: 'logout', color: '#e50914' },
    ];

    // Usar hook para gerenciar grupo de focusables
    const { setRef, getNavigation, nodeHandles, refs } = useTVFocusableGroup(menuItems.length);

    // Expose the first item's node handle and focus method via ref
    useImperativeHandle(ref, () => ({
        getFirstItemNodeHandle: () => {
            const handle = refs.current[0]?.getNodeHandle() ?? null;
            console.log('[Sidebar] getFirstItemNodeHandle called, result:', handle);
            return handle;
        },
        focusFirstItem: () => {
            console.log('[Sidebar] focusFirstItem called');
            if (refs.current[0]?.focus) {
                refs.current[0].focus();
            }
        },
    }), []);

    // Determine if screen is small (less than 600px height, like 720p TV)
    const isSmallScreen = screenHeight < 600;

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
                {menuItems.map((item, index) => {
                    const isActive = activeRoute === item.route;
                    const navigation = getNavigation(index);

                    return (
                        <TVFocusable
                            key={index}
                            ref={setRef(index)}
                            isActive={isActive}
                            onPress={() => handleNavigate(item.route)}
                            onFocus={() => setFocusArea('sidebar')}
                            hasTVPreferredFocus={index === 0}
                            nextFocusUp={navigation.nextFocusUp}
                            nextFocusDown={navigation.nextFocusDown}
                            nextFocusRight={getContentNodeHandle()}
                            nativeID={index === 0 ? SIDEBAR_FIRST_ITEM_ID : undefined}
                            style={[styles.menuItem, dynamicStyles.menuItem]}
                            focusedStyle={styles.menuItemFocused}
                            activeStyle={styles.menuItemActive}
                        >
                            {({ isFocused, isActive: isItemActive }) => (
                                <>
                                    <Ionicons
                                        name={item.icon as any}
                                        size={dynamicStyles.icon.size}
                                        color={item.color || (isItemActive ? Colors.primary : (isFocused ? '#fff' : '#888'))}
                                    />
                                    <Text
                                        style={[
                                            styles.menuText,
                                            isItemActive && styles.activeText,
                                            item.color ? { color: item.color } : null,
                                            isFocused && !isItemActive && styles.focusedText
                                        ]}
                                    >
                                        {item.label}
                                    </Text>
                                </>
                            )}
                        </TVFocusable>
                    );
                })}
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        height: '100%',
        backgroundColor: '#121212',
        borderRightWidth: 1,
        borderRightColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100, // Ensure sidebar is always on top
        elevation: 10, // Android elevation
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
        borderWidth: 2,
        borderColor: 'transparent',
    },
    menuItemActive: {
        backgroundColor: 'rgba(30, 215, 96, 0.1)',
        transform: [{ scale: 1.1 }],
        // borderColor: 'rgba(30, 215, 96, 0.3)',
    },
    menuItemFocused: {
        // backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderColor: 'rgba(30, 215, 96, 0.3)',
    },
    menuText: {
        color: '#888',
        fontSize: 12,
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

Sidebar.displayName = 'Sidebar';
