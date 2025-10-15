// Update your main.js file

import { loadPyodideEnvironment } from './pyodide-loader.js';
import { runNotebook } from './notebook-runner.js';
import { setupTableResponsiveWrapping, setupNotebookIndex } from './utils.js';

export function initializeApp() {
    // Set up the notebook index/sidebar
    setupNotebookIndex();
    
    // Set up responsive table wrapping
    setupTableResponsiveWrapping();
    
    const runAllBtn = document.getElementById('runAllBtn');
    
    // First load Pyodide
    loadPyodideEnvironment()
        .then(() => {
            // Then set up the run button
            runAllBtn.addEventListener('click', async () => {
                runAllBtn.disabled = true;
                runAllBtn.textContent = 'Running...';
                const statusMessage = document.getElementById('statusMessage');
                statusMessage.textContent = 'Executing notebook...';

                try {
                    await runNotebook();
                } catch (e) {
                    statusMessage.innerHTML = `<span class="error">An error occurred: ${e.message}</span>`;
                    console.error('Notebook execution error:', e);
                } finally {
                    runAllBtn.disabled = false;
                    runAllBtn.textContent = 'Run the whole notebook';
                }
            });
        })
        .catch(error => {
            console.error('Failed to initialize application:', error);
        });
}