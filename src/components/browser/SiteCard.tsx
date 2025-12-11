/**
 * SiteCard - Individual site card component for the suggestions grid
 * 
 * Displays a predefined streaming site with its icon, name, and description.
 * Supports TV focus navigation.
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TVFocusable } from '../TVFocusable';
import { Colors } from '../../constants/Colors';
import { PredefinedSite } from '../../constants/PredefinedSites';

interface SiteCardProps {
    site: PredefinedSite;
    onPress: () => void;
    hasTVPreferredFocus?: boolean;
}

export const SiteCard = memo(({
    site,
    onPress,
    hasTVPreferredFocus = false
}: SiteCardProps) => {
    return (
        <TVFocusable
            onPress={onPress}
            style={styles.container}
            focusedStyle={styles.containerFocused}
            hasTVPreferredFocus={hasTVPreferredFocus}
        >
            {({ isFocused }) => (
                <View style={styles.content}>
                    <View style={[styles.iconContainer, { backgroundColor: site.color }]}>
                        <Ionicons
                            name={site.icon as any}
                            size={32}
                            color="#fff"
                        />
                    </View>
                    <View style={styles.textContainer}>
                        <Text
                            style={[styles.name, isFocused && styles.nameFocused]}
                            numberOfLines={1}
                        >
                            {site.name}
                        </Text>
                        {site.description && (
                            <Text
                                style={styles.description}
                                numberOfLines={1}
                            >
                                {site.description}
                            </Text>
                        )}
                    </View>
                </View>
            )}
        </TVFocusable>
    );
});

SiteCard.displayName = 'SiteCard';

const styles = StyleSheet.create({
    container: {
        width: '48%',
        backgroundColor: Colors.surfaceLight,
        borderRadius: 12,
        padding: 16,
        borderWidth: 2,
        borderColor: 'transparent',
        marginBottom: 12,
    },
    containerFocused: {
        borderColor: Colors.primaryDark,
        backgroundColor: Colors.successLight,
        transform: [{ scale: 1.02 }],
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        flex: 1,
        marginLeft: 12,
    },
    name: {
        color: Colors.text,
        fontSize: 16,
        fontWeight: '600',
    },
    nameFocused: {
        color: Colors.primaryDark,
    },
    description: {
        color: Colors.textMuted,
        fontSize: 12,
        marginTop: 2,
    },
});

export default SiteCard;