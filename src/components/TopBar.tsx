import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { syncTimeWithServer } from '../services/timeService';


interface TopBarProps {
    onSearch?: (text: string) => void;
    searchValue?: string;
    onBack?: () => void;
}

export const TopBar = ({ onSearch, searchValue, onBack }: TopBarProps) => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [timeOffset, setTimeOffset] = useState(0);

    useEffect(() => {
        // Call sync time only once on component mount
        syncTime();

        // Local ticker for smooth seconds updates
        const timer = setInterval(() => {
            setCurrentTime(new Date(Date.now() + timeOffset));
        }, 1000);

        return () => {
            clearInterval(timer);
        };
    }, []); // Empty dependency array means this runs only once on mount

    useEffect(() => {
        // Update interval when timeOffset changes
        const timer = setInterval(() => {
            setCurrentTime(new Date(Date.now() + timeOffset));
        }, 1000);

        return () => {
            clearInterval(timer);
        };
    }, [timeOffset]);

    const syncTime = async () => {
        const offset = await syncTimeWithServer();
        setTimeOffset(offset);
        setCurrentTime(new Date(Date.now() + offset));
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo'
        });
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: 'America/Sao_Paulo'
        });
    };

    return (
        <View style={styles.container}>
            {/* Search Bar & Back Button */}
            <View style={styles.leftContainer}>
                {onBack && (
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={28} color="#fff" />
                    </TouchableOpacity>
                )}
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Buscar canal ou partida..."
                        placeholderTextColor="#666"
                        value={searchValue}
                        onChangeText={onSearch}
                    />
                    <Ionicons name="mic" size={20} color={Colors.primary} style={styles.micIcon} />
                </View>
            </View>

            {/* Clock */}
            <View style={styles.clockContainer}>
                <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                <Text style={styles.dateText}>{formatDate(currentTime)}</Text>
            </View>
        </View>
    );
};

const Colors = {
    primary: '#00ff88' // Using local definition or import if preferred
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingVertical: 20,
        width: '100%',
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '50%',
    },
    backButton: {
        marginRight: 20,
        padding: 5,
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 30,
        paddingHorizontal: 15,
        height: 50,
    },
    searchIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
        height: '100%',
    },
    micIcon: {
        marginLeft: 10,
    },
    clockContainer: {
        alignItems: 'flex-end',
    },
    timeText: {
        color: '#fff',
        fontSize: 32,
        fontWeight: '300',
    },
    dateText: {
        color: '#aaa',
        fontSize: 12,
        textTransform: 'capitalize',
    },
});
