
/**
 * Extracts content from within the <body>...</body> tags of an HTML string.
 * This is useful for displaying the main content of a full HTML document
 * within a smaller preview area in an application.
 *
 * @param htmlString The full HTML document as a string.
 * @returns The content within the <body> tags, or the original string if <body> tags are not found or malformed.
 */
export const extractBodyContent = (htmlString: string): string => {
    if (!htmlString || typeof htmlString !== 'string') {
        return '';
    }

    const cleanHtml = cleanGeneratedHtml(htmlString);

    const bodyStartTag = /<body[^>]*>/i;
    const bodyEndTag = /<\/body>/i;

    const bodyStartIndexMatch = cleanHtml.match(bodyStartTag);
    if (!bodyStartIndexMatch || typeof bodyStartIndexMatch.index === 'undefined') {
        // No <body> tag found, return original string or empty if it looks like a full doc start
        return cleanHtml.trim().toLowerCase().startsWith('<!doctype') || cleanHtml.trim().toLowerCase().startsWith('<html') ? '' : cleanHtml;
    }

    const contentAfterBodyStartTag = cleanHtml.substring(bodyStartIndexMatch.index + bodyStartIndexMatch[0].length);
    
    const bodyEndIndexMatch = contentAfterBodyStartTag.match(bodyEndTag);
    if (!bodyEndIndexMatch || typeof bodyEndIndexMatch.index === 'undefined') {
        // No </body> tag found (yet, possibly streaming), return content from <body> start
        return contentAfterBodyStartTag.trim();
    }

    return contentAfterBodyStartTag.substring(0, bodyEndIndexMatch.index).trim();
};

/**
 * Очищает строку от Markdown разметки кода (```html ... ```).
 * Если нейросеть вернула код внутри блоков, эта функция вырежет блоки, оставив только контент.
 */
export const cleanGeneratedHtml = (input: string): string => {
    if (!input) return '';

    // 1. Попытка найти контент МЕЖДУ тегами ```html и ```
    // Используем [^]*? для захвата любых символов, включая переносы строк, в нежадном режиме
    const match = input.match(/```(?:html)?\s*([^]*?)\s*```/i);
    if (match && match[1]) {
        return match[1].trim();
    }

    // 2. Если парных тегов нет, просто удаляем любые остаточные маркеры начала/конца, если они есть
    let cleaned = input.replace(/```html/gi, '').replace(/```/g, '');
    
    return cleaned.trim();
};
