import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Modal, StatusBar, Animated } from 'react-native';
import { ChannelList } from './ChannelList';
import { Channel } from '../services/channelService';
import { LinearGradient } from 'expo-linear-gradient';

interface ChannelListOverlayProps {
    visible: boolean;
    onClose: () => void;
    onChannelSelect: (channel: Channel) => void;
    onExit: () => void;
    initialCategory?: string;
}

export const ChannelListOverlay = ({ visible, onClose, onChannelSelect, onExit, initialCategory }: ChannelListOverlayProps) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const hasBeenVisible = useRef(false);

    // Track if overlay was ever shown (for pre-loading)
    useEffect(() => {
        if (visible) {
            hasBeenVisible.current = true;
            // Fade in quickly
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
            }).start();
        } else {
            // Fade out
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }).start();
        }
    }, [visible, fadeAnim]);

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
                <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
                {/* Content */}
                <View style={styles.content}>
                    <LinearGradient
                        colors={['rgba(0, 0, 0, 0.98)', 'rgba(0, 0, 0, 0.90)']}
                        style={styles.gradient}
                    >
                        <View style={styles.listContainer}>
                            <ChannelList
                                onChannelSelect={onChannelSelect}
                                onBack={onExit}
                                transparent={true}
                                initialCategory={initialCategory}
                            />
                        </View>
                    </LinearGradient>
                </View>
            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    content: {
        flex: 1,
    },
    gradient: {
        flex: 1,
    },
    listContainer: {
        flex: 1,
    },
});
