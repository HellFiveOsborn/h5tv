import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, Pressable, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Channel } from '../../services/channelService';
import { ProgramInfo } from '../../services/guideService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PlayerOverlayProps {
    visible: boolean;
    fadeAnim: Animated.Value;
    currentChannel: Partial<Channel>;
    programInfo: ProgramInfo | null;
    currentTime: string;
    currentUrlIndex: number;
    totalUrls: number;
    onSourceSwitch: () => void;
    onFocusChange?: (focused: boolean) => void;
}

export const PlayerOverlay = ({
    visible,
    fadeAnim,
    currentChannel,
    programInfo,
    currentTime,
    currentUrlIndex,
    totalUrls,
    onSourceSwitch,
    onFocusChange
}: PlayerOverlayProps) => {
    const [isSourceFocused, setIsSourceFocused] = useState(false);
    const [isLogoFocused, setIsLogoFocused] = useState(false);

    // Notify parent about focus changes to prevent auto-hide
    useEffect(() => {
        if (onFocusChange) {
            onFocusChange(isSourceFocused || isLogoFocused);
        }
    }, [isSourceFocused, isLogoFocused, onFocusChange]);

    if (!visible) return null;

    const getProgress = () => {
        if (!programInfo?.startTime || !programInfo?.endTime) return 0;
        const now = new Date().getTime();
        const start = new Date(programInfo.startTime).getTime();
        const end = new Date(programInfo.endTime).getTime();

        if (now < start) return 0;
        if (now > end) return 1;
        if (end <= start) return 0;

        return (now - start) / (end - start);
    };

    const progress = getProgress();
    const progressPercent = `${Math.min(Math.max(progress * 100, 0), 100)}%` as any;

    // Calculate remaining time
    const getRemainingTime = () => {
        if (!programInfo?.endTime) return null;
        const now = new Date().getTime();
        const end = new Date(programInfo.endTime).getTime();
        const remaining = Math.max(0, end - now);
        const minutes = Math.floor(remaining / 60000);
        if (minutes > 60) {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            return `${hours}h${mins}min restantes`;
        }
        return `${minutes}min restantes`;
    };

    return (
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} pointerEvents="box-none">
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
                locations={[0, 0.3, 1]}
                style={styles.gradient}
            >
                <View style={styles.content}>
                    {/* Left Section: Logo */}
                    <Pressable
                        focusable={true}
                        hasTVPreferredFocus={true}
                        onFocus={() => setIsLogoFocused(true)}
                        onBlur={() => setIsLogoFocused(false)}
                        style={[
                            styles.logoContainer,
                            isLogoFocused && styles.logoContainerFocused
                        ]}
                    >
                        <Image
                            source={{ uri: currentChannel.logo }}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </Pressable>

                    {/* Center Section: Channel & Program Info */}
                    <View style={styles.infoSection}>
                        {/* Channel Name */}
                        <Text style={styles.channelName} numberOfLines={1}>
                            {currentChannel.name}
                        </Text>

                        {programInfo ? (
                            <>
                                {/* Current Program */}
                                <View style={styles.programRow}>
                                    <Text style={styles.programTitle} numberOfLines={1}>
                                        {programInfo.title}
                                    </Text>
                                    <Text style={styles.programTime}>
                                        {programInfo.time}
                                    </Text>
                                </View>

                                {/* Progress Bar */}
                                <View style={styles.progressContainer}>
                                    <View style={styles.progressBar}>
                                        <View style={[styles.progressFill, { width: progressPercent }]} />
                                    </View>
                                    <Text style={styles.remainingTime}>
                                        {getRemainingTime()}
                                    </Text>
                                </View>

                                {/* Next Program */}
                                {programInfo.next && (
                                    <View style={styles.nextProgramRow}>
                                        <Text style={styles.nextLabel}>A seguir:</Text>
                                        <Text style={styles.nextTitle} numberOfLines={1}>
                                            {programInfo.next.title}
                                        </Text>
                                        <Text style={styles.nextTime}>
                                            {programInfo.next.time}
                                        </Text>
                                    </View>
                                )}
                            </>
                        ) : (
                            <View style={styles.programRow}>
                                <View style={styles.liveBadge}>
                                    <View style={styles.liveDot} />
                                    <Text style={styles.liveText}>AO VIVO</Text>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Right Section: Time & Controls */}
                    <View style={styles.rightSection}>
                        <Text style={styles.clock}>{currentTime}</Text>

                        {totalUrls > 1 && (
                            <Pressable
                                onPress={onSourceSwitch}
                                onFocus={() => setIsSourceFocused(true)}
                                onBlur={() => setIsSourceFocused(false)}
                                style={[
                                    styles.sourceButton,
                                    isSourceFocused && styles.sourceButtonFocused
                                ]}
                                focusable={true}
                            >
                                <Ionicons
                                    name="swap-horizontal"
                                    size={18}
                                    color={isSourceFocused ? "#1ed760" : "#aaa"}
                                />
                                <Text style={[
                                    styles.sourceText,
                                    isSourceFocused && styles.sourceTextFocused
                                ]}>
                                    Fonte {currentUrlIndex + 1}/{totalUrls}
                                </Text>
                            </Pressable>
                        )}
                    </View>
                </View>
            </LinearGradient>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 180,
    },
    gradient: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingBottom: 25,
        paddingHorizontal: 30,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
    },
    logoContainer: {
        width: 80,
        height: 80,
        backgroundColor: 'rgba(30,30,30,0.9)',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    logoContainerFocused: {
        borderColor: '#1ed760',
        transform: [{ scale: 1.05 }],
    },
    logo: {
        width: 60,
        height: 60,
    },
    infoSection: {
        flex: 1,
        justifyContent: 'center',
    },
    channelName: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    programRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    programTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
    },
    programTime: {
        color: '#aaa',
        fontSize: 14,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
    },
    progressBar: {
        flex: 1,
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#1ed760',
        borderRadius: 3,
    },
    remainingTime: {
        color: '#888',
        fontSize: 12,
        minWidth: 100,
    },
    nextProgramRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    nextLabel: {
        color: '#666',
        fontSize: 13,
    },
    nextTitle: {
        color: '#999',
        fontSize: 13,
        flex: 1,
    },
    nextTime: {
        color: '#666',
        fontSize: 12,
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(229, 9, 20, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
        gap: 6,
    },
    liveDot: {
        width: 8,
        height: 8,
        backgroundColor: '#e50914',
        borderRadius: 4,
    },
    liveText: {
        color: '#e50914',
        fontSize: 13,
        fontWeight: 'bold',
    },
    rightSection: {
        alignItems: 'flex-end',
        gap: 10,
    },
    clock: {
        color: '#fff',
        fontSize: 32,
        fontWeight: '300',
    },
    sourceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 6,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    sourceButtonFocused: {
        backgroundColor: 'rgba(30, 215, 96, 0.15)',
        borderColor: '#1ed760',
    },
    sourceText: {
        color: '#aaa',
        fontSize: 13,
    },
    sourceTextFocused: {
        color: '#1ed760',
        fontWeight: '600',
    },
});
