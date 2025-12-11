import React, { memo, useCallback, useRef, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ActivityIndicator, TextInputProps } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusArea } from '../constants/FocusContext';

interface SearchInputProps extends Omit<TextInputProps, 'onChangeText' | 'value'> {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    isSearching?: boolean;
    onClear?: () => void;
    showMicIcon?: boolean;
    autoFocus?: boolean;
}

/**
 * Reusable SearchInput component with focus area integration
 * and optimized rendering
 */
export const SearchInput = memo(({
    value,
    onChangeText,
    placeholder = 'Buscar canal ou partida...',
    isSearching = false,
    onClear,
    showMicIcon = true,
    autoFocus = false,
    ...textInputProps
}: SearchInputProps) => {
    const { setFocusArea } = useFocusArea();
    const inputRef = useRef<TextInput>(null);
    const [isFocused, setIsFocused] = useState(false);

    const handleFocus = useCallback(() => {
        setIsFocused(true);
        setFocusArea('search');
    }, [setFocusArea]);

    const handleBlur = useCallback(() => {
        setIsFocused(false);
        setFocusArea('none');
    }, [setFocusArea]);

    const handleClear = useCallback(() => {
        onChangeText('');
        onClear?.();
        inputRef.current?.focus();
    }, [onChangeText, onClear]);

    const showClearButton = value.length > 0;

    return (
        <View style={[styles.container, isFocused && styles.containerFocused]}>
            <Ionicons
                name="search"
                size={20}
                color={isFocused ? '#00ff88' : '#888'}
                style={styles.searchIcon}
            />

            <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder={placeholder}
                placeholderTextColor="#666"
                value={value}
                onChangeText={onChangeText}
                onFocus={handleFocus}
                onBlur={handleBlur}
                autoFocus={autoFocus}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                {...textInputProps}
            />

            {isSearching && (
                <ActivityIndicator
                    size="small"
                    color="#00ff88"
                    style={styles.loadingIndicator}
                />
            )}

            {showClearButton && !isSearching && (
                <Pressable
                    onPress={handleClear}
                    style={styles.clearButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="close-circle" size={20} color="#888" />
                </Pressable>
            )}

            {showMicIcon && !showClearButton && !isSearching && (
                <Ionicons
                    name="mic"
                    size={20}
                    color="#00ff88"
                    style={styles.micIcon}
                />
            )}
        </View>
    );
});

SearchInput.displayName = 'SearchInput';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 30,
        paddingHorizontal: 15,
        height: 50,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    containerFocused: {
        borderColor: '#00ff88',
        backgroundColor: 'rgba(0, 255, 136, 0.1)',
    },
    searchIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
        height: '100%',
    },
    loadingIndicator: {
        marginLeft: 10,
    },
    clearButton: {
        marginLeft: 10,
        padding: 5,
    },
    micIcon: {
        marginLeft: 10,
    },
});