import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type FocusArea = 'none' | 'sidebar' | 'search' | 'slider' | 'content';

interface FocusContextType {
    currentFocusArea: FocusArea;
    setFocusArea: (area: FocusArea) => void;
    isAutoPlayAllowed: boolean;
}

const FocusContext = createContext<FocusContextType>({
    currentFocusArea: 'none',
    setFocusArea: () => { },
    isAutoPlayAllowed: true,
});

export const useFocusArea = () => useContext(FocusContext);

interface FocusProviderProps {
    children: ReactNode;
}

export const FocusProvider = ({ children }: FocusProviderProps) => {
    const [currentFocusArea, setCurrentFocusArea] = useState<FocusArea>('none');

    const setFocusArea = useCallback((area: FocusArea) => {
        setCurrentFocusArea(area);
    }, []);

    // Auto-play is allowed when focus is on sidebar, search, or none (no active focus)
    const isAutoPlayAllowed = currentFocusArea === 'none' ||
        currentFocusArea === 'sidebar' ||
        currentFocusArea === 'search';

    return (
        <FocusContext.Provider value={{ currentFocusArea, setFocusArea, isAutoPlayAllowed }}>
            {children}
        </FocusContext.Provider>
    );
};