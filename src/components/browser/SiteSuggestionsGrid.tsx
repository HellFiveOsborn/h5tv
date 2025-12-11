/**
 * SiteSuggestionsGrid - Grid of predefined streaming sites
 *
 * Displays a grid of site cards for quick navigation to popular streaming services.
 * Supports TV focus navigation with D-Pad.
 * Rendered inline in the browser content area (not as a modal).
 */

import React, { memo } from 'react';
import { View, ScrollView, StyleSheet, Text } from 'react-native';
import { SiteCard } from './SiteCard';
import { PREDEFINED_SITES, PredefinedSite } from '../../constants/PredefinedSites';
import { Colors } from '../../constants/Colors';

interface SiteSuggestionsGridProps {
    onSiteSelect: (site: PredefinedSite) => void;
}

export const SiteSuggestionsGrid = memo(({
    onSiteSelect,
}: SiteSuggestionsGridProps) => {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Sites de Streaming</Text>
                <Text style={styles.subtitle}>Selecione um site para navegar</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.grid}
                showsVerticalScrollIndicator={false}
            >
                {PREDEFINED_SITES.map((site, index) => (
                    <SiteCard
                        key={site.id}
                        site={site}
                        onPress={() => onSiteSelect(site)}
                        hasTVPreferredFocus={index === 0}
                    />
                ))}
            </ScrollView>
        </View>
    );
});

SiteSuggestionsGrid.displayName = 'SiteSuggestionsGrid';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
        padding: 24,
    },
    header: {
        marginBottom: 20,
    },
    title: {
        color: Colors.text,
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        color: Colors.textSecondary,
        fontSize: 16,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        gap: 16,
        paddingBottom: 24,
    },
});

export default SiteSuggestionsGrid;