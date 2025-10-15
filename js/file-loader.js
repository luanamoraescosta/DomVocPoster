// file-loader.js
import { getPyodideInstance } from './utils.js';

export async function loadExcelFiles() {
    const pyodide = getPyodideInstance();
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.textContent = 'Loading data files...';
    
    const files = [
        'data/KlosterDBExports/gs_monastery.xlsx',
        'data/KlosterDBExports/gs_monastery_location.xlsx',
        'data/KlosterDBExports/gs_places.xlsx'
    ];
    
    let loadedFiles = 0;
    
    for (const file of files) {
        try {
            const response = await fetch(file);
            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const fileName = file.split('/').pop();
                const dirPath = file.split('/').slice(0, -1).join('/');
                
                // Create directory structure in Pyodide FS
                try {
                    await pyodide.runPythonAsync(`
                        import os
                        os.makedirs('/${dirPath}', exist_ok=True)
                    `);
                } catch (e) {
                    console.log("Directory already exists or error creating:", e);
                }
                
                // Write file to virtual filesystem
                pyodide.FS.writeFile(`/${file}`, new Uint8Array(arrayBuffer));
                loadedFiles++;
            } else {
                console.log(`File not found: ${file} (status ${response.status})`);
            }
        } catch (e) {
            console.error(`Error loading ${file}:`, e);
        }
    }
    
    statusMessage.textContent = `Loaded ${loadedFiles} data files.`;
    return loadedFiles > 0;
}