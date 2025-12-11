import React from 'react';
import { View, Text, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { Colors } from '../constants/Colors';

interface SimpleMarkdownProps {
    children: string;
    style?: {
        body?: TextStyle;
        heading1?: TextStyle;
        heading2?: TextStyle;
        heading3?: TextStyle;
        paragraph?: TextStyle;
        listItem?: TextStyle;
        strong?: TextStyle;
        hr?: ViewStyle;
    };
}

interface ParsedBlock {
    type: 'heading1' | 'heading2' | 'heading3' | 'paragraph' | 'listItem' | 'hr';
    content: string;
}

/**
 * Lightweight Markdown renderer for release notes.
 * Supports: Headings (#, ##, ###), Bold (**text**), Lists (- or *), Horizontal rules (---)
 */
export const SimpleMarkdown: React.FC<SimpleMarkdownProps> = ({ children, style }) => {
    const parseMarkdown = (text: string): ParsedBlock[] => {
        const lines = text.split('\n');
        const blocks: ParsedBlock[] = [];

        for (const line of lines) {
            const trimmedLine = line.trim();

            if (!trimmedLine) continue;

            // Horizontal rule
            if (/^[-_*]{3,}$/.test(trimmedLine)) {
                blocks.push({ type: 'hr', content: '' });
                continue;
            }

            // Headings
            if (trimmedLine.startsWith('### ')) {
                blocks.push({ type: 'heading3', content: trimmedLine.slice(4) });
            } else if (trimmedLine.startsWith('## ')) {
                blocks.push({ type: 'heading2', content: trimmedLine.slice(3) });
            } else if (trimmedLine.startsWith('# ')) {
                blocks.push({ type: 'heading1', content: trimmedLine.slice(2) });
            }
            // List items
            else if (/^[-*+]\s/.test(trimmedLine)) {
                blocks.push({ type: 'listItem', content: trimmedLine.slice(2) });
            }
            // Regular paragraph
            else {
                blocks.push({ type: 'paragraph', content: trimmedLine });
            }
        }

        return blocks;
    };

    const renderInlineFormatting = (text: string, baseStyle: TextStyle): React.ReactNode[] => {
        const parts: React.ReactNode[] = [];
        const boldRegex = /\*\*(.+?)\*\*/g;
        let lastIndex = 0;
        let match;

        while ((match = boldRegex.exec(text)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
                parts.push(
                    <Text key={`text-${lastIndex}`} style={baseStyle}>
                        {text.slice(lastIndex, match.index)}
                    </Text>
                );
            }
            // Add bold text
            parts.push(
                <Text key={`bold-${match.index}`} style={[baseStyle, style?.strong, styles.strong]}>
                    {match[1]}
                </Text>
            );
            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < text.length) {
            parts.push(
                <Text key={`text-${lastIndex}`} style={baseStyle}>
                    {text.slice(lastIndex)}
                </Text>
            );
        }

        return parts.length > 0 ? parts : [<Text key="text-0" style={baseStyle}>{text}</Text>];
    };

    const blocks = parseMarkdown(children);

    return (
        <View style={[styles.container, style?.body]}>
            {blocks.map((block, index) => {
                switch (block.type) {
                    case 'heading1':
                        return (
                            <Text key={index} style={[styles.heading1, style?.heading1]}>
                                {renderInlineFormatting(block.content, { ...styles.heading1, ...style?.heading1 })}
                            </Text>
                        );
                    case 'heading2':
                        return (
                            <Text key={index} style={[styles.heading2, style?.heading2]}>
                                {renderInlineFormatting(block.content, { ...styles.heading2, ...style?.heading2 })}
                            </Text>
                        );
                    case 'heading3':
                        return (
                            <Text key={index} style={[styles.heading3, style?.heading3]}>
                                {renderInlineFormatting(block.content, { ...styles.heading3, ...style?.heading3 })}
                            </Text>
                        );
                    case 'listItem':
                        return (
                            <View key={index} style={styles.listItemContainer}>
                                <Text style={[styles.bullet, { color: Colors.primary }]}>•</Text>
                                <Text style={[styles.listItem, style?.listItem]}>
                                    {renderInlineFormatting(block.content, { ...styles.listItem, ...style?.listItem })}
                                </Text>
                            </View>
                        );
                    case 'hr':
                        return <View key={index} style={[styles.hr, style?.hr]} />;
                    case 'paragraph':
                    default:
                        return (
                            <Text key={index} style={[styles.paragraph, style?.paragraph]}>
                                {renderInlineFormatting(block.content, { ...styles.paragraph, ...style?.paragraph })}
                            </Text>
                        );
                }
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    heading1: {
        color: Colors.text,
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
        marginTop: 15,
    },
    heading2: {
        color: Colors.text,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
        marginTop: 12,
    },
    heading3: {
        color: Colors.text,
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 6,
        marginTop: 10,
    },
    paragraph: {
        color: Colors.text,
        fontSize: 14,
        lineHeight: 22,
        marginBottom: 10,
    },
    listItemContainer: {
        flexDirection: 'row',
        marginBottom: 5,
        marginLeft: 10,
    },
    bullet: {
        fontSize: 14,
        marginRight: 10,
    },
    listItem: {
        color: Colors.text,
        fontSize: 14,
        lineHeight: 22,
        flex: 1,
    },
    strong: {
        fontWeight: 'bold',
    },
    hr: {
        backgroundColor: Colors.border,
        height: 1,
        marginVertical: 15,
    },
});