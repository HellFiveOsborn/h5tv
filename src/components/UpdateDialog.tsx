import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { UpdateInfo, downloadUpdate, installUpdate } from '../services/updateService';

interface UpdateDialogProps {
    visible: boolean;
    updateInfo: UpdateInfo | null;
    onCancel: () => void;
}

export const UpdateDialog: React.FC<UpdateDialogProps> = ({ visible, updateInfo, onCancel }) => {
    const [downloading, setDownloading] = useState(false);
    const [progress, setProgress] = useState(0);

    if (!updateInfo) return null;

    const handleUpdate = async () => {
        setDownloading(true);
        const fileUri = await downloadUpdate(updateInfo.downloadUrl, (p) => setProgress(p));
        setDownloading(false);
        if (fileUri) {
            await installUpdate(fileUri);
        } else {
            // Handle error (maybe show an alert)
            alert('Falha ao baixar a atualização.');
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.dialog}>
                    <Text style={styles.title}>Nova Atualização Disponível</Text>
                    <Text style={styles.version}>Versão: {updateInfo.version}</Text>

                    <ScrollView style={styles.notesContainer}>
                        <Text style={styles.notes}>{updateInfo.releaseNotes}</Text>
                    </ScrollView>

                    {downloading ? (
                        <View style={styles.progressContainer}>
                            <Text style={styles.progressText}>Baixando... {Math.round(progress * 100)}%</Text>
                            <ActivityIndicator size="small" color="#007AFF" />
                        </View>
                    ) : (
                        <View style={styles.buttons}>
                            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel}>
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.button, styles.updateButton]} onPress={handleUpdate}>
                                <Text style={styles.updateButtonText}>Atualizar Agora</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dialog: {
        width: '80%',
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        elevation: 5,
        maxHeight: '80%',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#333',
        textAlign: 'center',
    },
    version: {
        fontSize: 16,
        color: '#666',
        marginBottom: 10,
        textAlign: 'center',
    },
    notesContainer: {
        maxHeight: 200,
        marginBottom: 20,
        backgroundColor: '#f5f5f5',
        padding: 10,
        borderRadius: 8,
    },
    notes: {
        fontSize: 14,
        color: '#333',
    },
    progressContainer: {
        alignItems: 'center',
        padding: 20,
    },
    progressText: {
        marginBottom: 10,
        fontSize: 16,
        color: '#333',
    },
    buttons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    button: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 5,
    },
    cancelButton: {
        backgroundColor: '#e0e0e0',
    },
    updateButton: {
        backgroundColor: '#007AFF',
    },
    cancelButtonText: {
        color: '#333',
        fontWeight: 'bold',
    },
    updateButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
});
