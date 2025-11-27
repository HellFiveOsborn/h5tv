import React, { memo, forwardRef, useRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Channel } from '../services/channelService';
import { ProgramInfo } from '../services/guideService';
import { TVFocusable, TVFocusableRef } from './TVFocusable';
import { ProgramProgressBar } from './ProgramProgressBar';

export interface ChannelListItemRef {
    getNodeHandle: () => number | null;
}

interface ChannelListItemProps {
    channel: Channel;
    programInfo?: ProgramInfo | null;
    onPress: () => void;
    onFocus?: () => void;
    onBlur?: () => void;
    hasTVPreferredFocus?: boolean;
    nextFocusUp?: number;
    nextFocusDown?: number;
    nextFocusLeft?: number;
    nextFocusRight?: number;
}

/**
 * Horizontal channel list item for vertical carousel
 * Full-height logo on left, channel name and programming info on right
 * Shows program info and progress bar on all items
 * Next program only visible when focused
 */
export const ChannelListItem = memo(forwardRef<ChannelListItemRef, ChannelListItemProps>(({
    channel,
    programInfo,
    onPress,
    onFocus,
    onBlur,
    hasTVPreferredFocus = false,
    nextFocusUp,
    nextFocusDown,
    nextFocusLeft,
    nextFocusRight,
}, ref) => {
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
            nextFocusUp={nextFocusUp}
            nextFocusDown={nextFocusDown}
            nextFocusLeft={nextFocusLeft}
            nextFocusRight={nextFocusRight}
            style={styles.container}
            focusedStyle={styles.containerFocused}
        >
            {({ isFocused }) => (
                <View style={[styles.content, isFocused && styles.contentFocused]}>
                    {/* Logo Container - Full Height, Full Fill */}
                    <View style={[styles.logoContainer, isFocused && styles.logoContainerFocused]}>
                        <Image
                            source={{ uri: channel.logo }}
                            style={styles.logo}
                            resizeMode="cover"
                        />
                    </View>

                    {/* Info Container */}
                    <View style={[styles.infoContainer, isFocused && styles.infoContainerFocused]}>
                        {/* Channel Name */}
                        <Text
                            style={[styles.channelName, isFocused && styles.channelNameFocused]}
                            numberOfLines={1}
                        >
                            {channel.name}
                        </Text>

                        {/* Current Program - Always visible */}
                        <View style={styles.programContainer}>
                            {programInfo ? (
                                <>
                                    <Text style={[styles.currentProgram, isFocused && styles.currentProgramFocused]} numberOfLines={1}>
                                        {programInfo.time} • {programInfo.title}
                                    </Text>

                                    {/* Progress Bar - Always visible */}
                                    <View style={[styles.progressBarContainer, isFocused && styles.progressBarContainerFocused]}>
                                        <ProgramProgressBar
                                            startTime={programInfo.startTime}
                                            endTime={programInfo.endTime}
                                            color="#1ed760"
                                            backgroundColor={isFocused ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.12)"}
                                            height={isFocused ? 6 : 4}
                                        />
                                    </View>

                                    {/* Next Program - Only show when focused */}
                                    {isFocused && programInfo.next && (
                                        <Text style={styles.nextProgram} numberOfLines={1}>
                                            A seguir: {programInfo.next.time} • {programInfo.next.title}
                                        </Text>
                                    )}
                                </>
                            ) : (
                                <View style={[styles.liveBadge, isFocused && styles.liveBadgeFocused]}>
                                    <View style={styles.liveDot} />
                                    <Text style={styles.liveText}>AO VIVO</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            )}
        </TVFocusable>
    );
}), (prevProps, nextProps) => {
    return (
        prevProps.channel.id === nextProps.channel.id &&
        prevProps.programInfo?.title === nextProps.programInfo?.title &&
        prevProps.programInfo?.time === nextProps.programInfo?.time &&
        prevProps.programInfo?.startTime?.toString() === nextProps.programInfo?.startTime?.toString() &&
        prevProps.programInfo?.endTime?.toString() === nextProps.programInfo?.endTime?.toString() &&
        prevProps.hasTVPreferredFocus === nextProps.hasTVPreferredFocus
    );
});

ChannelListItem.displayName = 'ChannelListItem';

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'transparent',
        marginBottom: 10,
        height: 95,
        overflow: 'hidden',
    },
    containerFocused: {
        borderColor: '#1ed760',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 12,
    },
    content: {
        flex: 1,
        flexDirection: 'row',
    },
    contentFocused: {
        // Additional styling when focused
    },
    logoContainer: {
        width: 130,
        height: '100%',
        backgroundColor: '#141414',
        overflow: 'hidden',
    },
    logoContainerFocused: {
        backgroundColor: '#1a1a1a',
    },
    logo: {
        width: '100%',
        height: '100%',
    },
    infoContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    infoContainerFocused: {
        paddingHorizontal: 22,
    },
    channelName: {
        color: '#e0e0e0',
        fontSize: 17,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    channelNameFocused: {
        color: '#fff',
        fontSize: 19,
    },
    programContainer: {
        marginTop: 2,
    },
    currentProgram: {
        color: '#888',
        fontSize: 13,
        marginBottom: 6,
    },
    currentProgramFocused: {
        color: '#bbb',
        fontSize: 14,
    },
    progressBarContainer: {
        width: '100%',
        marginBottom: 6,
    },
    progressBarContainerFocused: {
        marginBottom: 8,
    },
    nextProgram: {
        color: '#666',
        fontSize: 12,
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(30, 215, 96, 0.12)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
        alignSelf: 'flex-start',
        gap: 6,
    },
    liveBadgeFocused: {
        backgroundColor: 'rgba(30, 215, 96, 0.2)',
    },
    liveDot: {
        width: 8,
        height: 8,
        backgroundColor: '#1ed760',
        borderRadius: 4,
    },
    liveText: {
        color: '#1ed760',
        fontSize: 13,
        fontWeight: 'bold',
    },
});