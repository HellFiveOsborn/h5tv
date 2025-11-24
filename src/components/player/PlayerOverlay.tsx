import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, Pressable, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Channel } from '../../services/channelService';
import { ProgramInfo } from '../../services/guideService';

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
    const sourceButtonRef = useRef<View>(null);

    // Auto-focus the source button when overlay becomes visible
    useEffect(() => {
        // Auto-focus removed per user request to avoid focus stealing on open
    }, [visible, totalUrls]);

    // Notify parent about focus changes to prevent auto-hide
    useEffect(() => {
        if (onFocusChange) {
            onFocusChange(isSourceFocused || isLogoFocused);
        }
    }, [isSourceFocused, isLogoFocused]);

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

    const progressPercent = `${Math.min(Math.max(getProgress() * 100, 0), 100)}%` as any;

    return (
        <Animated.View style={[styles.bottomOverlay, { opacity: fadeAnim }]} pointerEvents="box-none">
            <LinearGradient
                colors={['rgba(20,20,20,0.95)', 'rgba(20,20,20,0.98)']}
                style={styles.bottomBar}
            >
                {/* Left: Channel & Program Info */}
                <View style={styles.leftSection}>
                    <Pressable
                        focusable={true}
                        hasTVPreferredFocus={true}
                        onFocus={() => setIsLogoFocused(true)}
                        onBlur={() => setIsLogoFocused(false)}
                        style={[
                            isLogoFocused && { transform: [{ scale: 1.1 }] }
                        ]}
                    >
                        <Image source={{ uri: currentChannel.logo }} style={styles.channelLogo} resizeMode="contain" />
                    </Pressable>
                    <View style={styles.infoContainer}>
                        <Text style={styles.channelName}>{currentChannel.name}</Text>
                        {programInfo ? (
                            <>
                                <View style={styles.programRow}>
                                    <Text style={styles.programTitle} numberOfLines={1}>
                                        {programInfo.title}
                                    </Text>
                                    <Text style={styles.programTime}> {programInfo.time}</Text>
                                </View>

                                {/* Progress Bar */}
                                <View style={styles.progressBarContainer}>
                                    <View style={[styles.progressBarFill, { width: progressPercent }]} />
                                </View>

                                {programInfo.next && (
                                    <Text style={styles.nextProgramTitle} numberOfLines={1}>
                                        <Text style={{ opacity: 0.7 }}>Próximo: </Text>
                                        {programInfo.next.title}
                                        <Text style={styles.nextProgramTime}> {programInfo.next.time}</Text>
                                    </Text>
                                )}
                            </>
                        ) : (
                            <Text style={styles.programTitle}>Sem informações do guia</Text>
                        )}
                    </View>
                </View>

                {/* Right: Time & Controls */}
                <View style={styles.rightSection}>
                    <Text style={styles.clockText}>{currentTime}</Text>

                    {totalUrls > 1 && (
                        <Pressable
                            ref={sourceButtonRef}
                            onPress={onSourceSwitch}
                            onFocus={() => setIsSourceFocused(true)}
                            onBlur={() => setIsSourceFocused(false)}
                            style={({ pressed }) => [
                                styles.sourceButton,
                                isSourceFocused && styles.sourceButtonFocused,
                                pressed && { opacity: 0.8 }
                            ]}
                            focusable={true}
                            hasTVPreferredFocus={false}
                        >
                            <Ionicons
                                name="swap-horizontal"
                                size={20}
                                color={isSourceFocused ? "#fff" : "#ccc"}
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
            </LinearGradient>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    bottomOverlay: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        alignItems: 'center',
    },
    bottomBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingVertical: 15,
        paddingHorizontal: 25,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    leftSection: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    channelLogo: {
        width: 60,
        height: 60,
    },
    infoContainer: {
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    channelName: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    programRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 6,
    },
    programTitle: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    programTime: {
        color: '#aaa',
        fontSize: 13,
        fontWeight: '400',
        marginLeft: 8,
    },
    progressBarContainer: {
        width: '100%',
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2,
        marginBottom: 6,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#1ed760',
        borderRadius: 2,
    },
    nextProgramTitle: {
        color: '#ccc',
        fontSize: 13,
    },
    nextProgramTime: {
        color: '#888',
        fontSize: 12,
    },
    rightSection: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 5,
    },
    clockText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '300',
    },
    sourceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    sourceButtonFocused: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    sourceText: {
        color: '#ccc',
        fontSize: 12,
        marginLeft: 6,
    },
    sourceTextFocused: {
        color: '#fff',
    },
});
