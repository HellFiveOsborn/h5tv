import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, Pressable, StyleSheet, ViewStyle, StyleProp, findNodeHandle, PressableProps } from 'react-native';

// Extended props for TV navigation (these exist at runtime on Android TV)
interface TVPressableProps extends PressableProps {
    hasTVPreferredFocus?: boolean;
    nextFocusUp?: number;
    nextFocusDown?: number;
    nextFocusLeft?: number;
    nextFocusRight?: number;
}

const TVPressable = Pressable as React.ComponentType<TVPressableProps & React.RefAttributes<View>>;

export interface TVFocusableRef {
    getNodeHandle: () => number | null;
    focus: () => void;
}

export interface TVFocusableProps {
    // Estado
    isActive?: boolean;
    disabled?: boolean;

    // Foco inicial
    hasTVPreferredFocus?: boolean;

    // Native ID for focus target
    nativeID?: string;

    // Navegação (node handles)
    nextFocusUp?: number;
    nextFocusDown?: number;
    nextFocusLeft?: number;
    nextFocusRight?: number;

    // Estilos
    style?: StyleProp<ViewStyle>;
    focusedStyle?: StyleProp<ViewStyle>;
    activeStyle?: StyleProp<ViewStyle>;

    // Callbacks
    onPress?: () => void;
    onFocus?: () => void;
    onBlur?: () => void;
    onFocusChange?: (isFocused: boolean) => void;

    // Conteúdo - render prop para acessar estado de foco
    children: React.ReactNode | ((state: { isFocused: boolean; isActive: boolean }) => React.ReactNode);
}

export const TVFocusable = forwardRef<TVFocusableRef, TVFocusableProps>(({
    isActive = false,
    disabled = false,
    hasTVPreferredFocus = false,
    nativeID,
    nextFocusUp,
    nextFocusDown,
    nextFocusLeft,
    nextFocusRight,
    style,
    focusedStyle,
    activeStyle,
    onPress,
    onFocus,
    onBlur,
    onFocusChange,
    children,
}, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const pressableRef = useRef<View>(null);

    useImperativeHandle(ref, () => ({
        getNodeHandle: () => pressableRef.current ? findNodeHandle(pressableRef.current) : null,
        focus: () => {
            // Android TV focus request
            if (pressableRef.current) {
                (pressableRef.current as any).setNativeProps?.({ hasTVPreferredFocus: true });
            }
        },
    }));

    const handleFocus = () => {
        setIsFocused(true);
        onFocus?.();
        onFocusChange?.(true);
    };

    const handleBlur = () => {
        setIsFocused(false);
        onBlur?.();
        onFocusChange?.(false);
    };

    const handlePress = () => {
        if (!disabled) {
            onPress?.();
        }
    };

    // Ensure props are properly passed to TVPressable
    const tvProps = {
        hasTVPreferredFocus,
        nextFocusUp,
        nextFocusDown,
        nextFocusLeft,
        nextFocusRight,
    };

    // Combina estilos baseado no estado
    // Se ativo: sempre aplica activeStyle (mantém indicação visual do item ativo)
    // Se focado: aplica focusedStyle por cima (adiciona highlight de navegação)
    // Se ativo E focado: ambos são aplicados (activeStyle como base + focusedStyle por cima)
    const combinedStyle: StyleProp<ViewStyle>[] = [
        styles.base,
        style,
        isActive && activeStyle,    // Sempre aplica se ativo
        isFocused && styles.focused,
        isFocused && focusedStyle,  // Aplica focusedStyle por cima se focado
    ].filter(Boolean) as StyleProp<ViewStyle>[];

    // Renderiza children como função ou elemento
    const renderChildren = () => {
        if (typeof children === 'function') {
            return children({ isFocused, isActive });
        }
        return children;
    };

    return (
        <TVPressable
            ref={pressableRef}
            nativeID={nativeID}
            onPress={handlePress}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={combinedStyle}
            disabled={disabled}
            {...tvProps}
        >
            {renderChildren()}
        </TVPressable>
    );
});

TVFocusable.displayName = 'TVFocusable';

// Estilos padrão - podem ser sobrescritos via props
const styles = StyleSheet.create({
    base: {
        // Estilo base vazio - definido pelo usuário
    },
    focused: {
        // Minimal focus style - no scale to prevent overflow issues
        // Components should provide their own focusedStyle for custom effects
    },
});

// Hook auxiliar para gerenciar grupo de focusables
export const useTVFocusableGroup = (count: number) => {
    const refs = useRef<(TVFocusableRef | null)[]>([]);
    const [nodeHandles, setNodeHandles] = useState<(number | null)[]>([]);

    useEffect(() => {
        // Delay para garantir que refs estão montadas
        const timer = setTimeout(() => {
            const handles = refs.current.map(ref => ref?.getNodeHandle() ?? null);
            setNodeHandles(handles);
        }, 100);
        return () => clearTimeout(timer);
    }, [count]);

    const setRef = (index: number) => (ref: TVFocusableRef | null) => {
        refs.current[index] = ref;
    };

    const getNavigation = (index: number) => ({
        nextFocusUp: index > 0 ? nodeHandles[index - 1] ?? undefined : undefined,
        nextFocusDown: index < count - 1 ? nodeHandles[index + 1] ?? undefined : undefined,
    });

    return { setRef, getNavigation, nodeHandles, refs };
};

export default TVFocusable;