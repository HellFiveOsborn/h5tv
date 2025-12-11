import React, { useState, useEffect } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

export const ConnectionInfo = () => {
    const [speed, setSpeed] = useState<string>('0 Kbps');
    const [color, setColor] = useState<string>('#fff');

    useEffect(() => {
        let isMounted = true;

        const checkSpeed = async () => {
            const startTime = Date.now();
            const fileSizeInBytes = 50000; // Approx 50KB (using a small fetch or just timing a request)
            // We'll use a cache-busting URL to a small resource. 
            // Using a reliable CDN or just a ping to google/cloudflare is often used for latency, 
            // but for speed we need to download something.
            // Let's try fetching a small image from a public CDN.
            const url = `https://www.google.com/images/branding/googlelogo/2x/googlelogo_light_color_92x30dp.png?t=${startTime}`;

            try {
                const response = await fetch(url, { cache: 'no-store' });
                if (response.ok) {
                    const endTime = Date.now();
                    const durationInSeconds = (endTime - startTime) / 1000;
                    const bitsLoaded = fileSizeInBytes * 8;
                    const bps = bitsLoaded / durationInSeconds;
                    const kbps = bps / 1024;
                    const mbps = kbps / 1024;

                    if (isMounted) {
                        if (mbps >= 1) {
                            setSpeed(`${mbps.toFixed(1)} Mbps`);
                            setColor(mbps > 5 ? '#1ed760' : '#fff'); // Green if good speed
                        } else {
                            setSpeed(`${kbps.toFixed(0)} Kbps`);
                            setColor('#fff');
                        }
                    }
                }
            } catch (error) {
                // Ignore errors
            }
        };

        // Check immediately then every 5 seconds
        checkSpeed();
        const interval = setInterval(checkSpeed, 5000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    return (
        <View style={styles.container}>
            <Ionicons name="wifi" size={14} color={color} style={styles.icon} />
            <Text style={[styles.text, { color }]}>{speed}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        opacity: 0.8,
        marginTop: 4,
    },
    icon: {
        marginRight: 4,
    },
    text: {
        fontSize: 12,
        fontWeight: '500',
    },
});
