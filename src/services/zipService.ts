
import JSZip from 'jszip';
import { Article } from '../types';
import { slugify } from '../utils/slugify';

export const downloadArticlesAsZip = async (articles: Article[], zipFilename: string = 'articles.zip') => {
    const zip = new JSZip();

    // Create a folder for articles
    const folder = zip.folder("generated_articles");

    if (!folder) throw new Error("Could not create zip folder");

    articles.forEach((article) => {
        const filename = `${slugify(article.topic)}.html`;
        folder.file(filename, article.content);
    });

    const content = await zip.generateAsync({ type: "blob" });
    
    // Download logic
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = zipFilename;
    document.body.appendChild(a);
    a.click();
    
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
};
