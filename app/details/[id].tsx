import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Colors } from '../../src/constants/Colors';

export default function Details() {
    const { id } = useLocalSearchParams();

    // In a real app, fetch data based on ID
    const movie = {
        title: `Movie ${id}`,
        description: 'This is a sample description for the movie. It would contain plot details, cast information, and other relevant metadata in a real application.',
        imageUrl: 'https://via.placeholder.com/400x300/111/fff?text=Movie+Cover',
    };

    return (
        <>
            <Stack.Screen options={{ title: movie.title }} />
            <ScrollView style={styles.container}>
                <Image source={{ uri: movie.imageUrl }} style={styles.coverImage} />
                <View style={styles.content}>
                    <Text style={styles.title}>{movie.title}</Text>
                    <View style={styles.metaRow}>
                        <Text style={styles.match}>98% Match</Text>
                        <Text style={styles.year}>2023</Text>
                        <View style={styles.ageContainer}>
                            <Text style={styles.age}>12+</Text>
                        </View>
                        <Text style={styles.seasons}>3 Seasons</Text>
                    </View>
                    <View style={styles.actions}>
                        <View style={styles.playButton}>
                            <Text style={styles.playButtonText}>Play</Text>
                        </View>
                        <View style={styles.downloadButton}>
                            <Text style={styles.downloadButtonText}>Download</Text>
                        </View>
                    </View>
                    <Text style={styles.description}>{movie.description}</Text>
                </View>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    coverImage: {
        width: '100%',
        height: 300,
        resizeMode: 'cover',
    },
    content: {
        padding: 16,
    },
    title: {
        color: Colors.text,
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    match: {
        color: '#46d369',
        fontWeight: 'bold',
        marginRight: 12,
    },
    year: {
        color: Colors.textSecondary,
        marginRight: 12,
    },
    ageContainer: {
        backgroundColor: '#333',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 2,
        marginRight: 12,
    },
    age: {
        color: Colors.textSecondary,
        fontSize: 12,
    },
    seasons: {
        color: Colors.textSecondary,
    },
    actions: {
        flexDirection: 'column',
        marginBottom: 20,
        gap: 10,
    },
    playButton: {
        backgroundColor: Colors.text,
        paddingVertical: 12,
        borderRadius: 4,
        alignItems: 'center',
    },
    playButtonText: {
        color: Colors.background,
        fontWeight: 'bold',
        fontSize: 16,
    },
    downloadButton: {
        backgroundColor: '#333',
        paddingVertical: 12,
        borderRadius: 4,
        alignItems: 'center',
    },
    downloadButtonText: {
        color: Colors.text,
        fontWeight: 'bold',
        fontSize: 16,
    },
    description: {
        color: Colors.text,
        fontSize: 16,
        lineHeight: 24,
    },
});
