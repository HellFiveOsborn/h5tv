/**
 * BrowserNavBar - Navigation bar for browser controls
 * 
 * Provides back, forward, reload, close buttons and URL input field.
 * Supports TV focus navigation with D-Pad.
 */

import React, { useState, memo, useEffect } from 'react';
import { View, TextInput, StyleSheet, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TVFocusable } from '../TVFocusable';
import { Colors } from '../../constants/Colors';

// Compact icon size for navbar buttons
const ICON_SIZE = 20;

interface BrowserNavBarProps {
    url: string;
    pageTitle: string;
    isLoading: boolean;
    canGoBack: boolean;
    canGoForward: boolean;
    onBack: () => void;
    onForward: () => void;
    onReload: () => void;
    onClose: () => void;
    onUrlSubmit: (url: string) => void;
    onFocusChange?: (focused: boolean) => void;
}

export const BrowserNavBar = memo(({
    url,
    pageTitle,
    isLoading,
    canGoBack,
    canGoForward,
    onBack,
    onForward,
    onReload,
    onClose,
    onUrlSubmit,
    onFocusChange
}: BrowserNavBarProps) => {
    const [inputValue, setInputValue] = useState(url);
    const [isEditing, setIsEditing] = useState(false);

    // Update input value when URL changes externally
    useEffect(() => {
        if (!isEditing) {
            setInputValue(url);
        }
    }, [url, isEditing]);

    // Check if a string is a valid URL
    const isValidUrl = (text: string): boolean => {
        // Check if it starts with a protocol
        if (text.startsWith('http://') || text.startsWith('https://')) {
            return true;
        }
        // Check if it looks like a URL (has domain-like pattern)
        const urlPattern = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/;
        // Or if it matches domain pattern (e.g., "google.com", "example.com/path")
        return urlPattern.test(text);
    };

    const handleSubmit = () => {
        const trimmed = inputValue.trim();
        if (!trimmed) return;

        let finalUrl: string;

        if (isValidUrl(trimmed)) {
            // It's a URL - add protocol if missing
            finalUrl = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
        } else {
            // It's a search query - use Google
            finalUrl = `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
        }

        onUrlSubmit(finalUrl);
        setIsEditing(false);
    };

    // Format URL for display - show domain and path
    const getDisplayUrl = () => {
        if (!url) return '';
        try {
            const urlObj = new URL(url);
            return urlObj.host + urlObj.pathname;
        } catch {
            return url;
        }
    };

    return (
        <View style={styles.container}>
            {/* Close Button */}
            <TVFocusable
                onPress={onClose}
                style={styles.navButton}
                focusedStyle={styles.navButtonFocused}
                onFocus={() => onFocusChange?.(true)}
                onBlur={() => onFocusChange?.(false)}
            >
                {({ isFocused }) => (
                    <Ionicons name="close" size={ICON_SIZE} color={isFocused ? Colors.primaryDark : Colors.text} />
                )}
            </TVFocusable>

            {/* Back Button */}
            <TVFocusable
                onPress={onBack}
                disabled={!canGoBack}
                style={[styles.navButton, !canGoBack && styles.navButtonDisabled]}
                focusedStyle={styles.navButtonFocused}
                onFocus={() => onFocusChange?.(true)}
                onBlur={() => onFocusChange?.(false)}
            >
                {({ isFocused }) => (
                    <Ionicons
                        name="chevron-back"
                        size={ICON_SIZE}
                        color={canGoBack ? (isFocused ? Colors.primaryDark : Colors.text) : Colors.textMuted}
                    />
                )}
            </TVFocusable>

            {/* Forward Button */}
            <TVFocusable
                onPress={onForward}
                disabled={!canGoForward}
                style={[styles.navButton, !canGoForward && styles.navButtonDisabled]}
                focusedStyle={styles.navButtonFocused}
                onFocus={() => onFocusChange?.(true)}
                onBlur={() => onFocusChange?.(false)}
            >
                {({ isFocused }) => (
                    <Ionicons
                        name="chevron-forward"
                        size={ICON_SIZE}
                        color={canGoForward ? (isFocused ? Colors.primaryDark : Colors.text) : Colors.textMuted}
                    />
                )}
            </TVFocusable>

            {/* Reload / Stop Button */}
            <TVFocusable
                onPress={onReload}
                style={styles.navButton}
                focusedStyle={styles.navButtonFocused}
                onFocus={() => onFocusChange?.(true)}
                onBlur={() => onFocusChange?.(false)}
            >
                {({ isFocused }) => (
                    <Ionicons
                        name={isLoading ? "close" : "reload"}
                        size={ICON_SIZE}
                        color={isFocused ? Colors.primaryDark : Colors.text}
                    />
                )}
            </TVFocusable>

            {/* Separator */}
            <View style={styles.separator} />

            {/* URL Input - Single line, compact */}
            <View style={styles.urlContainer}>
                {isEditing ? (
                    <TextInput
                        style={styles.urlInput}
                        value={inputValue}
                        onChangeText={setInputValue}
                        onSubmitEditing={handleSubmit}
                        onBlur={() => setIsEditing(false)}
                        autoFocus
                        selectTextOnFocus
                        placeholder="Digite URL ou pesquise no Google"
                        placeholderTextColor={Colors.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                    />
                ) : (
                    <TVFocusable
                        onPress={() => setIsEditing(true)}
                        style={styles.urlDisplay}
                        focusedStyle={styles.urlDisplayFocused}
                        onFocus={() => onFocusChange?.(true)}
                        onBlur={() => onFocusChange?.(false)}
                    >
                        {({ isFocused }) => (
                            <Text
                                style={[styles.urlText, isFocused && styles.urlTextFocused]}
                                numberOfLines={1}
                            >
                                {getDisplayUrl() || pageTitle || 'Digite URL ou selecione um site'}
                            </Text>
                        )}
                    </TVFocusable>
                )}
            </View>
        </View>
    );
});

BrowserNavBar.displayName = 'BrowserNavBar';

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        gap: 4,
        height: 48,
    },
    navButton: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 18,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    navButtonFocused: {
        borderColor: Colors.primaryDark,
        backgroundColor: Colors.successLight,
    },
    navButtonDisabled: {
        opacity: 0.4,
    },
    separator: {
        width: 1,
        height: 24,
        backgroundColor: Colors.border,
        marginHorizontal: 4,
    },
    urlContainer: {
        flex: 1,
        height: 36,
        justifyContent: 'center',
    },
    urlInput: {
        backgroundColor: Colors.focusBackground,
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 0,
        height: 32,
        color: Colors.text,
        fontSize: 14,
    },
    urlDisplay: {
        backgroundColor: Colors.focusBackground,
        borderRadius: 6,
        paddingHorizontal: 12,
        height: 32,
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    urlDisplayFocused: {
        borderColor: Colors.primaryDark,
        backgroundColor: Colors.successLight,
    },
    urlText: {
        color: Colors.text,
        fontSize: 14,
    },
    urlTextFocused: {
        color: Colors.primaryDark,
    },
});

export default BrowserNavBar;