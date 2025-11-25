import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, StatusBar } from 'react-native';
import { ChannelList } from './ChannelList';
import { Channel } from '../services/channelService';
import { LinearGradient } from 'expo-linear-gradient';

interface ChannelListOverlayProps {
    visible: boolean;
    onClose: () => void;
    onChannelSelect: (channel: Channel) => void;
    onExit: () => void;
}

export const ChannelListOverlay = ({ visible, onClose, onChannelSelect, onExit }: ChannelListOverlayProps) => {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <View style={styles.container}>
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
                            />
                        </View>
                    </LinearGradient>
                </View>
            </View>
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
