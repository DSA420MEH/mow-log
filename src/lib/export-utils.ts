import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

/**
 * Captures an element and exports it as a PDF.
 * @param elementId The ID of the HTML element to capture.
 * @param filename The name of the resulting PDF file.
 */
export const exportToPDF = async (elementId: string, filename: string) => {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Element with id ${elementId} not found.`);
        return;
    }

    try {
        const width = element.offsetWidth;
        const height = element.offsetHeight;
        
        // We use a pixelRatio of 2 for higher resolution
        const scale = 2;

        const imgData = await toPng(element, {
            backgroundColor: '#0a0f0d',
            pixelRatio: scale,
        });

        // The image rendered would have dimensions: width * scale, height * scale
        const pdfWidth = width * scale;
        const pdfHeight = height * scale;
        
        // Create PDF with the same dimensions as the high-res canvas output
        const pdf = new jsPDF({
            orientation: pdfWidth > pdfHeight ? 'l' : 'p',
            unit: 'px',
            format: [pdfWidth, pdfHeight]
        });

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${filename}.pdf`);
    } catch (error) {
        console.error('Error exporting PDF:', error);
    }
};
