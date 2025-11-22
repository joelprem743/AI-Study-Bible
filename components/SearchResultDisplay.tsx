
import React from 'react';
import type { FullVerse } from '../types';

interface SearchResultDisplayProps {
    results: FullVerse[];
    isLoading: boolean;
    error: string | null;
    onClear: () => void;
    englishVersion: string;
}

const SearchSkeleton: React.FC = () => (
    <div className="mb-8 animate-pulse">
        <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-1/3 mb-6"></div>
        <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-2 md:gap-6 p-3">
                    <div className="flex">
                        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-8 mr-2"></div>
                        <div className="space-y-2 flex-grow">
                            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full"></div>
                        </div>
                    </div>
                    <div className="hidden md:flex">
                         <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full"></div>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

export const SearchResultDisplay: React.FC<SearchResultDisplayProps> = ({ results, isLoading, error, onClear, englishVersion }) => {
    const groupedResults = results.reduce((acc, verse) => {
        const key = `${verse.book} ${verse.chapter}`;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(verse);
        return acc;
    }, {} as Record<string, FullVerse[]>);

    return (
        <div className="w-full h-full flex flex-col bg-gray-50 dark:bg-gray-900">
            <header className="p-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between sticky top-0 z-10">
                <h2 className="text-lg font-bold">Search Results</h2>
                <button
                    onClick={onClear}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
                >
                    <i className="fas fa-times mr-2"></i>
                    Back to Bible
                </button>
            </header>
            <div className="flex-grow overflow-y-auto p-4 md:p-6">
                {isLoading && (
                    <>
                        <SearchSkeleton />
                        <SearchSkeleton />
                    </>
                )}
                {error && (
                    <div className="text-center">
                        <p className="text-red-500 font-semibold">Error</p>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">{error}</p>
                    </div>
                )}
                {!isLoading && !error && results.length === 0 && (
                    <div className="text-center text-gray-500 dark:text-gray-400">
                        <p>No results found for your query.</p>
                    </div>
                )}
                {!isLoading && !error && Object.entries(groupedResults).map(([key, verses]) => (
                    <div key={key} className="mb-8">
                        <h3 className="text-2xl md:text-3xl font-bold mb-4 text-gray-800 dark:text-gray-200">{key}</h3>
                        <div className="space-y-4">
                            {verses.sort((a, b) => a.verse - b.verse).map(verse => {
                                const englishText = verse.text[englishVersion as keyof typeof verse.text] || verse.text.KJV;
                                return (
                                    <div
                                        key={verse.verse}
                                        className="p-3 rounded-lg bg-white dark:bg-gray-800/50"
                                    >
                                        <div className="grid grid-cols-1 md:grid-cols-2 md:gap-6">
                                            {/* Telugu Column */}
                                            <div className="flex">
                                                <span className="text-sm font-bold w-8 text-gray-500 dark:text-gray-400">{verse.verse}</span>
                                                <div>
                                                    {verse.text.BSI_TELUGU ? (
                                                        <p className="text-lg leading-relaxed">{verse.text.BSI_TELUGU}</p>
                                                    ) : (
                                                        <p className="text-sm italic text-gray-500 dark:text-gray-400">[Telugu not available]</p>
                                                    )}
                                                </div>
                                            </div>
                                            {/* English Column */}
                                            <div className="flex mt-2 md:mt-0">
                                                <span className="text-sm font-bold w-8 text-gray-500 dark:text-gray-400 md:hidden">{verse.verse}</span>
                                                <p className="leading-relaxed">{englishText}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
