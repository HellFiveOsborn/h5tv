import React, { memo } from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { Channel } from '../services/channelService';
import { ProgramInfo } from '../services/guideService';

interface ChannelCardProps {
    channel: Channel;
    programInfo?: ProgramInfo | null;
    isFocused: boolean;
    onPress: () => void;
    onFocus: () => void;
    onBlur: () => void;
}

/**
 * Memoized ChannelCard component for optimized list rendering
 * Only re-renders when channel, programInfo, or focus state changes
 */
export const ChannelCard = memo(({
    channel,
    programInfo,
    isFocused,
    onPress,
    onFocus,
    onBlur
}: ChannelCardProps) => {
    return (
        <View style={styles.cardWrapper}>
            <Pressable
                onPress={onPress}
                onFocus={onFocus}
                onBlur={onBlur}
                style={[
                    styles.channelCard,
                    isFocused && styles.channelCardFocused
                ]}
            >
                <View style={styles.cardContent}>
                    <View style={styles.logoContainer}>
                        <Image
                            source={{ uri: channel.logo }}
                            style={styles.channelLogo}
                            resizeMode="contain"
                        />
                    </View>
                    <View style={styles.channelInfo}>
                        <Text style={styles.channelName} numberOfLines={1}>
                            {channel.name}
                        </Text>
                        {programInfo ? (
                            <Text style={styles.programInfo} numberOfLines={1}>
                                {programInfo.time} • {programInfo.title}
                            </Text>
                        ) : (
                            <Text style={styles.programInfo} numberOfLines={1}>
                                AO VIVO
                            </Text>
                        )}
                    </View>
                </View>
            </Pressable>
        </View>
    );
}, (prevProps, nextProps) => {
    // Custom comparison for memo - only re-render if these change
    return (
        prevProps.channel.id === nextProps.channel.id &&
        prevProps.isFocused === nextProps.isFocused &&
        prevProps.programInfo?.title === nextProps.programInfo?.title &&
        prevProps.programInfo?.time === nextProps.programInfo?.time
    );
});

ChannelCard.displayName = 'ChannelCard';

const styles = StyleSheet.create({
    cardWrapper: {
        width: '48%',
        minWidth: 210,
        maxWidth: 450,
        aspectRatio: 1.6,
        overflow: 'visible',
    },
    channelCard: {
        width: '100%',
        height: '100%',
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
    },
    channelCardFocused: {
        backgroundColor: '#333',
        transform: [{ scale: 1.08 }],
        shadowColor: '#00ff88',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        borderWidth: 2,
        borderColor: '#00ff88',
    },
    cardContent: {
        width: '100%',
        height: '100%',
        borderRadius: 12,
        overflow: 'hidden',
    },
    logoContainer: {
        width: '100%',
        height: '65%',
        backgroundColor: '#0d0d0d',
        alignItems: 'center',
        justifyContent: 'center',
    },
    channelLogo: {
        width: '100%',
        height: '100%',
    },
    channelInfo: {
        width: '100%',
        height: '35%',
        justifyContent: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    channelName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    programInfo: {
        color: '#e50914',
        fontSize: 12,
        marginBottom: 6,
    },
});