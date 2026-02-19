
export const slugify = (text: string): string => {
    if (typeof text !== 'string') return 'untitled_article'; // Handle non-string input
    const trimmedText = text.trim();
    if (!trimmedText) return 'untitled_article'; // Handle empty or whitespace-only input

    let str = trimmedText;

    // Normalize Unicode characters to decompose combined characters (e.g., 'é' to 'e' + '´').
    // NFKD (Normalization Form Compatibility Decomposition) is suitable for this.
    str = str.normalize('NFKD');

    str = str.toLowerCase();

    // Remove combining diacritical marks (e.g., accents).
    // This step should come after toLowerCase and normalize.
    // The range U+0300–U+036F covers most combining diacritics.
    str = str.replace(/[\u0300-\u036f]/g, '');

    // Replace spaces and common separators/problematic characters with a single underscore.
    str = str.replace(/\s+/g, '_'); // Consolidate multiple spaces and replace with underscore
    
    // Replace a list of common problematic characters, including typographic quotes and dashes, with an underscore.
    // Added «, », „, “, ”, –, — for better handling of texts with rich typography.
    str = str.replace(/[/\\:,."'?<>|*&%$#@!()+=^{}[\]`~«»„“”–—]/g, '_');

    // Remove any remaining characters that are not:
    // - Unicode letters (\p{L}) - This correctly handles Cyrillic and other scripts.
    // - Unicode numbers (\p{N})
    // - Underscore (_)
    // - Hyphen (-)
    // The 'u' flag enables Unicode-aware patterns.
    str = str.replace(/[^\p{L}\p{N}_-]+/gu, '');

    // Clean up sequences of underscores or hyphens that might have resulted from previous replacements.
    str = str.replace(/__+/g, '_'); // Replace multiple underscores with a single underscore
    str = str.replace(/--+/g, '-'); // Replace multiple hyphens with a single hyphen

    // Optional: If you prefer only underscores and no hyphens (or vice-versa) for consistency.
    // For example, to convert all hyphens to underscores:
    // str = str.replace(/-/g, '_');
    // Then, re-run the multiple underscore cleanup if you made this change:
    // if (str.includes('-')) str = str.replace(/__+/g, '_');


    // Trim leading/trailing underscores or hyphens that might have formed at the edges of the string.
    str = str.replace(/^_+|_+$/g, ''); // Trim underscores from start/end
    str = str.replace(/^-+|-+$/g, ''); // Trim hyphens from start/end

    // Fallback if the string becomes empty after all operations (e.g., if the input was only symbols).
    if (!str) {
        return 'untitled_article';
    }

    // Optional: Limit filename length (most OS have limits around 255 characters/bytes)
    // const MAX_FILENAME_LENGTH = 100; // Example limit
    // if (str.length > MAX_FILENAME_LENGTH) {
    //     str = str.substring(0, MAX_FILENAME_LENGTH);
    //     // It's good practice to re-trim after truncating, in case a separator was cut.
    //     str = str.replace(/^_+|_+$/g, '');
    //     str = str.replace(/^-+|-+$/g, '');
    //     // If trimming after truncation results in an empty string, provide a fallback.
    //     if (!str) {
    //        return 'untitled_article_truncated';
    //     }
    // }

    return str;
};
