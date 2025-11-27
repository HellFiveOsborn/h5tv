import React, { memo, forwardRef, useRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, Image, ViewStyle, StyleProp, Dimensions } from 'react-native';
import { Channel } from '../services/channelService';
import { ProgramInfo } from '../services/guideService';
import { TVFocusable, TVFocusableRef } from './TVFocusable';

export interface ChannelCardRef {
    getNodeHandle: () => number | null;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Card sizes based on layout context
export type CardSize = 'small' | 'medium' | 'large';

interface ChannelCardProps {
    channel: Channel;
    programInfo?: ProgramInfo | null;
    isFocused?: boolean;
    onPress: () => void;
    onFocus?: () => void;
    onBlur?: () => void;
    hasTVPreferredFocus?: boolean;
    nextFocusUp?: number;
    nextFocusDown?: number;
    nextFocusLeft?: number;
    nextFocusRight?: number;
    size?: CardSize;
    style?: StyleProp<ViewStyle>;
}

// Size configurations
const SIZE_CONFIG = {
    small: {
        width: 150,
        height: 110,
        logoHeight: '62%',
        nameSize: 13,
        infoSize: 10,
        borderRadius: 8,
    },
    medium: {
        width: 200,
        height: 140,
        logoHeight: '65%',
        nameSize: 14,
        infoSize: 11,
        borderRadius: 10,
    },
    large: {
        width: 260,
        height: 180,
        logoHeight: '68%',
        nameSize: 16,
        infoSize: 12,
        borderRadius: 12,
    },
};

/**
 * Memoized ChannelCard component for optimized list rendering
 * Responsive and reusable across different layouts
 */
export const ChannelCard = memo(forwardRef<ChannelCardRef, ChannelCardProps>(({
    channel,
    programInfo,
    isFocused: externalFocused,
    onPress,
    onFocus,
    onBlur,
    hasTVPreferredFocus = false,
    size = 'medium',
    style,
}, ref) => {
    const config = SIZE_CONFIG[size];
    const focusableRef = useRef<TVFocusableRef>(null);

    useImperativeHandle(ref, () => ({
        getNodeHandle: () => focusableRef.current?.getNodeHandle() ?? null,
    }), []);

    return (
        <TVFocusable
            ref={focusableRef}
            onPress={onPress}
            onFocus={onFocus}
            onBlur={onBlur}
            hasTVPreferredFocus={hasTVPreferredFocus}
            style={[
                styles.channelCard,
                {
                    width: config.width,
                    height: config.height,
                    borderRadius: config.borderRadius,
                },
                style,
            ]}
            focusedStyle={styles.channelCardFocused}
        >
            {({ isFocused: internalFocused }) => {
                const isFocused = externalFocused !== undefined ? externalFocused : internalFocused;

                return (
                    <View style={[
                        styles.cardContent,
                        { borderRadius: config.borderRadius },
                    ]}>
                        <View style={[
                            styles.logoContainer,
                            { height: config.logoHeight as any },
                        ]}>
                            <Image
                                source={{ uri: channel.logo }}
                                style={styles.channelLogo}
                                resizeMode="contain"
                            />
                        </View>
                        <View style={styles.channelInfo}>
                            <Text
                                style={[styles.channelName, { fontSize: config.nameSize }]}
                                numberOfLines={1}
                            >
                                {channel.name}
                            </Text>
                            {programInfo ? (
                                <Text
                                    style={[styles.programInfo, { fontSize: config.infoSize }]}
                                    numberOfLines={1}
                                >
                                    {programInfo.time} • {programInfo.title}
                                </Text>
                            ) : (
                                <Text
                                    style={[styles.programInfo, { fontSize: config.infoSize }]}
                                    numberOfLines={1}
                                >
                                    AO VIVO
                                </Text>
                            )}
                        </View>
                    </View>
                );
            }}
        </TVFocusable>
    );
}), (prevProps, nextProps) => {
    return (
        prevProps.channel.id === nextProps.channel.id &&
        prevProps.isFocused === nextProps.isFocused &&
        prevProps.size === nextProps.size &&
        prevProps.programInfo?.title === nextProps.programInfo?.title &&
        prevProps.programInfo?.time === nextProps.programInfo?.time
    );
});

ChannelCard.displayName = 'ChannelCard';

const styles = StyleSheet.create({
    channelCard: {
        backgroundColor: '#1a1a1a',
        borderWidth: 2,
        borderColor: 'transparent',
        overflow: 'hidden',
    },
    channelCardFocused: {
        backgroundColor: '#2a2a2a',
        borderColor: '#00ff88',
        shadowColor: '#00ff88',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 6,
    },
    cardContent: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
    },
    logoContainer: {
        width: '100%',
        backgroundColor: '#0d0d0d',
        alignItems: 'center',
        justifyContent: 'center',
    },
    channelLogo: {
        width: '100%',
        height: '100%',
    },
    channelInfo: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    channelName: {
        color: '#fff',
        fontWeight: 'bold',
        marginBottom: 2,
    },
    programInfo: {
        color: '#e50914',
    },
});