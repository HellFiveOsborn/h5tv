import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { Colors } from '../constants/Colors';

export const SplashScreen = () => {
    return (
        <View style={styles.container}>
            <Image
                source={require('../../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
            />
            <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
            <Text style={styles.loadingText}>Carregando...</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999,
    },
    logo: {
        width: 200,
        height: 200,
        marginBottom: 20,
    },
    loader: {
        marginBottom: 10,
    },
    loadingText: {
        color: Colors.text,
        fontSize: 16,
    },
});
