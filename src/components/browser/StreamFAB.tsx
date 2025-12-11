/**
 * StreamFAB - Floating Action Button for collected streams
 * 
 * Shows a badge with the number of captured streams.
 * When pressed, expands to show a list of all captured streams.
 * User can tap a stream to open it in the player.
 */

import React, { memo, useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    FlatList,
    Pressable,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import type { StreamHeaders } from '../../utils/streamInterceptor';

export interface CapturedStream {
    url: string;
    headers: StreamHeaders;
    type: string;
    timestamp: Date;
}

interface StreamFABProps {
    streams: CapturedStream[];
    onSelectStream: (stream: CapturedStream) => void;
    onClearStreams: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Helper to determine stream type from URL
const getStreamType = (url: string): string => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('.m3u8') || lowerUrl.includes('/manifest')) return 'HLS';
    if (lowerUrl.includes('.mpd')) return 'DASH';
    if (lowerUrl.includes('.mp4')) return 'MP4';
    if (lowerUrl.includes('googlevideo.com')) return 'YouTube';
    if (lowerUrl.includes('ttvnw.net')) return 'Twitch';
    return 'Stream';
};

// Helper to truncate URL for display
const truncateUrl = (url: string, maxLength: number = 50): string => {
    if (url.length <= maxLength) return url;

    // Try to show domain + end of path
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        const path = urlObj.pathname + urlObj.search;

        if (domain.length + 10 >= maxLength) {
            return domain.substring(0, maxLength - 3) + '...';
        }

        const remainingLength = maxLength - domain.length - 6;
        const truncatedPath = '...' + path.slice(-remainingLength);
        return domain + truncatedPath;
    } catch {
        return url.substring(0, maxLength - 3) + '...';
    }
};

// Format timestamp
const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
};

export const StreamFAB = memo(({
    streams,
    onSelectStream,
    onClearStreams,
}: StreamFABProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const expandAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const previousCount = useRef(streams.length);

    // Pulse animation when new stream is detected
    useEffect(() => {
        if (streams.length > previousCount.current) {
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start();
        }
        previousCount.current = streams.length;
    }, [streams.length, pulseAnim]);

    // Expand/collapse animation
    useEffect(() => {
        Animated.spring(expandAnim, {
            toValue: isExpanded ? 1 : 0,
            useNativeDriver: false,
            friction: 8,
            tension: 50,
        }).start();
    }, [isExpanded, expandAnim]);

    const toggleExpanded = () => {
        setIsExpanded(!isExpanded);
    };

    const handleSelectStream = (stream: CapturedStream) => {
        setIsExpanded(false);
        onSelectStream(stream);
    };

    const handleClear = () => {
        setIsExpanded(false);
        onClearStreams();
    };

    // Don't render if no streams
    if (streams.length === 0) return null;

    // Animated styles
    const listHeight = expandAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, Math.min(streams.length * 72 + 60, SCREEN_HEIGHT * 0.5)],
    });

    const listOpacity = expandAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, 0.5, 1],
    });

    const rotateIcon = expandAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
    });

    return (
        <View style={styles.container}>
            {/* Expanded List */}
            <Animated.View
                style={[
                    styles.listContainer,
                    {
                        height: listHeight,
                        opacity: listOpacity,
                    },
                ]}
            >
                {isExpanded && (
                    <>
                        {/* Header */}
                        <View style={styles.listHeader}>
                            <Text style={styles.listTitle}>
                                Streams Detectados ({streams.length})
                            </Text>
                            <TouchableOpacity
                                onPress={handleClear}
                                style={styles.clearButton}
                            >
                                <Ionicons name="trash-outline" size={18} color={Colors.textSecondary} />
                                <Text style={styles.clearText}>Limpar</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Stream List */}
                        <FlatList
                            data={streams}
                            keyExtractor={(item, index) => `${item.url}-${index}`}
                            renderItem={({ item }) => (
                                <Pressable
                                    onPress={() => handleSelectStream(item)}
                                    style={({ pressed }) => [
                                        styles.streamItem,
                                        pressed && styles.streamItemPressed,
                                    ]}
                                >
                                    <View style={styles.streamIcon}>
                                        <Ionicons
                                            name="play-circle"
                                            size={24}
                                            color={Colors.primary}
                                        />
                                    </View>
                                    <View style={styles.streamInfo}>
                                        <Text style={styles.streamUrl} numberOfLines={1}>
                                            {truncateUrl(item.url)}
                                        </Text>
                                        <View style={styles.streamMeta}>
                                            <View style={styles.typeBadge}>
                                                <Text style={styles.typeText}>
                                                    {getStreamType(item.url)}
                                                </Text>
                                            </View>
                                            <Text style={styles.timestamp}>
                                                {formatTime(item.timestamp)}
                                            </Text>
                                        </View>
                                    </View>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={20}
                                        color={Colors.textSecondary}
                                    />
                                </Pressable>
                            )}
                            style={styles.list}
                            showsVerticalScrollIndicator={false}
                        />
                    </>
                )}
            </Animated.View>

            {/* FAB Button */}
            <Animated.View
                style={[
                    styles.fabContainer,
                    {
                        transform: [{ scale: pulseAnim }],
                    },
                ]}
            >
                <TouchableOpacity
                    onPress={toggleExpanded}
                    style={styles.fab}
                    activeOpacity={0.8}
                >
                    {/* Badge */}
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{streams.length}</Text>
                    </View>

                    {/* Icon */}
                    <Ionicons
                        name="videocam"
                        size={28}
                        color="white"
                    />

                    {/* Expand indicator */}
                    <Animated.View
                        style={[
                            styles.expandIndicator,
                            { transform: [{ rotate: rotateIcon }] },
                        ]}
                    >
                        <Ionicons
                            name="chevron-up"
                            size={16}
                            color="white"
                        />
                    </Animated.View>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
});

StreamFAB.displayName = 'StreamFAB';

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        alignItems: 'flex-end',
        zIndex: 999998,
    },
    fabContainer: {
        // Shadow for elevation effect
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
    },
    fab: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#EF4444', // Red
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
        borderWidth: 2,
        borderColor: Colors.surface,
    },
    badgeText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    expandIndicator: {
        position: 'absolute',
        bottom: 4,
        opacity: 0.7,
    },
    listContainer: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        marginBottom: 12,
        overflow: 'hidden',
        width: Math.min(SCREEN_WIDTH - 40, 400),
        // Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    listHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    listTitle: {
        color: Colors.text,
        fontSize: 14,
        fontWeight: '600',
    },
    clearButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    clearText: {
        color: Colors.textSecondary,
        fontSize: 12,
    },
    list: {
        flex: 1,
    },
    streamItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    streamItemPressed: {
        backgroundColor: Colors.surfaceLight,
    },
    streamIcon: {
        marginRight: 12,
    },
    streamInfo: {
        flex: 1,
    },
    streamUrl: {
        color: Colors.text,
        fontSize: 13,
        marginBottom: 4,
    },
    streamMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    typeBadge: {
        backgroundColor: Colors.primaryDark,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    typeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '600',
    },
    timestamp: {
        color: Colors.textSecondary,
        fontSize: 11,
    },
});

export default StreamFAB;