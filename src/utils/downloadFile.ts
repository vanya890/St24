
export const downloadFile = (blob: Blob, filename: string): void => {
    try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none'; // Hide the anchor
        a.href = url;
        a.download = filename;
        
        document.body.appendChild(a);
        a.click();
        
        // Cleanup: remove the anchor and revoke the object URL
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (e) {
        console.error("Ошибка при попытке скачивания файла:", e);
        // Provide feedback to the user if possible, e.g., via an alert or a status message
        alert(`Не удалось скачать файл "${filename}". Проверьте консоль для деталей.`);
    }
};
