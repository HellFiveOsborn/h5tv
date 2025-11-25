import React, { useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { Ionicons } from '@expo/vector-icons';
import { UpdateInfo, downloadUpdate, installUpdate } from '../services/updateService';
import { Colors } from '../constants/Colors';

interface UpdateDialogProps {
    visible: boolean;
    updateInfo: UpdateInfo | null;
    onCancel: () => void;
}

export const UpdateDialog: React.FC<UpdateDialogProps> = ({ visible, updateInfo, onCancel }) => {
    const [downloading, setDownloading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [cancelFocused, setCancelFocused] = useState(false);
    const [updateFocused, setUpdateFocused] = useState(false);

    if (!updateInfo) return null;

    const handleUpdate = async () => {
        setDownloading(true);
        const fileUri = await downloadUpdate(updateInfo.downloadUrl, (p) => setProgress(p));
        setDownloading(false);
        if (fileUri) {
            await installUpdate(fileUri);
        } else {
            alert('Falha ao baixar a atualização.');
        }
    };

    const markdownStyles = {
        body: {
            color: Colors.text,
            fontSize: 14,
            lineHeight: 22,
        },
        heading1: {
            color: Colors.text,
            fontSize: 20,
            fontWeight: 'bold' as const,
            marginBottom: 10,
            marginTop: 15,
        },
        heading2: {
            color: Colors.text,
            fontSize: 18,
            fontWeight: 'bold' as const,
            marginBottom: 8,
            marginTop: 12,
        },
        heading3: {
            color: Colors.text,
            fontSize: 16,
            fontWeight: 'bold' as const,
            marginBottom: 6,
            marginTop: 10,
        },
        paragraph: {
            color: Colors.text,
            marginBottom: 10,
        },
        listItem: {
            color: Colors.text,
            marginBottom: 5,
        },
        listUnorderedItemIcon: {
            color: Colors.primary,
            fontSize: 8,
            marginRight: 10,
        },
        bullet_list: {
            marginLeft: 10,
        },
        ordered_list: {
            marginLeft: 10,
        },
        code_inline: {
            backgroundColor: Colors.surface,
            color: Colors.primary,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
            fontFamily: 'monospace',
        },
        fence: {
            backgroundColor: Colors.surface,
            padding: 10,
            borderRadius: 8,
            marginVertical: 10,
        },
        code_block: {
            color: Colors.text,
            fontFamily: 'monospace',
        },
        link: {
            color: Colors.primary,
        },
        strong: {
            color: Colors.text,
            fontWeight: 'bold' as const,
        },
        em: {
            color: Colors.textSecondary,
            fontStyle: 'italic' as const,
        },
        hr: {
            backgroundColor: Colors.border,
            height: 1,
            marginVertical: 15,
        },
    };

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.dialog}>
                    <View style={styles.header}>
                        <Ionicons name="cloud-download-outline" size={28} color={Colors.primary} />
                        <Text style={styles.title}>Nova Atualização Disponível</Text>
                    </View>

                    <View style={styles.versionBadge}>
                        <Ionicons name="pricetag-outline" size={16} color={Colors.primary} />
                        <Text style={styles.versionText}>Versão {updateInfo.version}</Text>
                    </View>

                    <View style={styles.notesHeader}>
                        <Ionicons name="document-text-outline" size={18} color={Colors.textSecondary} />
                        <Text style={styles.notesTitle}>Notas de Lançamento</Text>
                    </View>

                    <ScrollView style={styles.notesContainer} showsVerticalScrollIndicator={true}>
                        <Markdown style={markdownStyles}>
                            {updateInfo.releaseNotes || 'Sem notas de lançamento disponíveis.'}
                        </Markdown>
                    </ScrollView>

                    {downloading ? (
                        <View style={styles.progressContainer}>
                            <View style={styles.progressBarContainer}>
                                <View style={[styles.progressBar, { width: `${Math.round(progress * 100)}%` }]} />
                            </View>
                            <View style={styles.progressInfo}>
                                <ActivityIndicator size="small" color={Colors.primary} />
                                <Text style={styles.progressText}>Baixando... {Math.round(progress * 100)}%</Text>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.buttons}>
                            <Pressable
                                style={[
                                    styles.button,
                                    styles.cancelButton,
                                    cancelFocused && styles.buttonFocused
                                ]}
                                onPress={onCancel}
                                onFocus={() => setCancelFocused(true)}
                                onBlur={() => setCancelFocused(false)}
                                focusable={true}
                            >
                                <Ionicons name="close-outline" size={20} color={cancelFocused ? '#fff' : Colors.textSecondary} />
                                <Text style={[styles.cancelButtonText, cancelFocused && styles.buttonTextFocused]}>Depois</Text>
                            </Pressable>
                            <Pressable
                                style={[
                                    styles.button,
                                    styles.updateButton,
                                    updateFocused && styles.updateButtonFocused
                                ]}
                                onPress={handleUpdate}
                                onFocus={() => setUpdateFocused(true)}
                                onBlur={() => setUpdateFocused(false)}
                                focusable={true}
                            >
                                <Ionicons name="download-outline" size={20} color="#000" />
                                <Text style={styles.updateButtonText}>Atualizar Agora</Text>
                            </Pressable>
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
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dialog: {
        width: '60%',
        maxWidth: 600,
        backgroundColor: Colors.surface,
        borderRadius: 16,
        padding: 24,
        elevation: 10,
        maxHeight: '85%',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        gap: 12,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.text,
    },
    versionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(90, 229, 9, 0.15)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        alignSelf: 'center',
        marginBottom: 20,
        gap: 8,
    },
    versionText: {
        fontSize: 16,
        color: Colors.primary,
        fontWeight: '600',
    },
    notesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 8,
    },
    notesTitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    notesContainer: {
        maxHeight: 250,
        marginBottom: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    progressContainer: {
        padding: 16,
    },
    progressBarContainer: {
        height: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 12,
    },
    progressBar: {
        height: '100%',
        backgroundColor: Colors.primary,
        borderRadius: 4,
    },
    progressInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    progressText: {
        fontSize: 14,
        color: Colors.text,
        fontWeight: '500',
    },
    buttons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    buttonFocused: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 2,
        borderColor: Colors.text,
    },
    cancelButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    updateButton: {
        backgroundColor: Colors.primary,
    },
    updateButtonFocused: {
        backgroundColor: '#6fff1a',
        borderWidth: 2,
        borderColor: '#fff',
    },
    cancelButtonText: {
        color: Colors.textSecondary,
        fontWeight: '600',
        fontSize: 16,
    },
    buttonTextFocused: {
        color: '#fff',
    },
    updateButtonText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
