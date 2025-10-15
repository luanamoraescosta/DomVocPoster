// pyodide-loader.js
import { updateStepStatus, setPyodideInstance } from './utils.js';

export async function loadPyodideEnvironment() {
    const statusDiv = document.getElementById('pyodideStatus');
    const runAllBtn = document.getElementById('runAllBtn');
    const statusMessage = document.getElementById('statusMessage');
    
    try {
        statusDiv.innerHTML = '<p>Loading Pyodide library... (this may take a minute)</p>';
        
        // Create script element to load Pyodide
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
        
        // Show loading indicator
        document.getElementById('globalLoader').style.display = 'inline-block';
        statusMessage.textContent = 'Downloading Pyodide runtime...';
        
        // Wait for the script to load
        await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load Pyodide library'));
            document.head.appendChild(script);
        });
        
        statusDiv.innerHTML = '<p>Initializing Python environment...</p>';
        statusMessage.textContent = 'Initializing Python environment...';
        
        // Now that pyodide.js is loaded, we can call loadPyodide
        const pyodide = await loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/',
            stdout: (msg) => console.log('Pyodide:', msg),
            stderr: (msg) => console.error('Pyodide error:', msg),
            fullStdLib: false,
            // Increased memory to 2GB for pandas
            memorySize: 2 * 1024 * 1024 * 1024
        });
        
        // Store the instance using our setter function
        setPyodideInstance(pyodide);
        
        statusDiv.innerHTML = '<p>Python environment ready! Click the button below to run the notebook.</p>';
        document.getElementById('globalLoader').style.display = 'none';
        runAllBtn.disabled = false;
        runAllBtn.textContent = 'Run the whole notebook';
        statusMessage.textContent = 'Python environment initialized successfully.';
        
        return pyodide;
        
    } catch (e) {
        document.getElementById('globalLoader').style.display = 'none';
        statusDiv.innerHTML = `<div class="error">Failed to load Pyodide: ${e.message}</div>`;
        statusMessage.innerHTML = `<span class="error">Initialization error: ${e.message}</span>`;
        console.error('Pyodide initialization error:', e);
        throw e;
    }
}