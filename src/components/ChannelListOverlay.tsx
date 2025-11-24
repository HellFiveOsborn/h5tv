import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity } from 'react-native';
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
        >
            <View style={styles.container}>
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
        flexDirection: 'row',
    },
    content: {
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent',
    },
    gradient: {
        flex: 1,
    },
    listContainer: {
        flex: 1,
    },
});
