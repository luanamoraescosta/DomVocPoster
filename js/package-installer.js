// package-installer.js
import { getPyodideInstance, updateStepStatus } from './utils.js';

export async function installPythonPackages() {
    const pyodide = getPyodideInstance();
    const statusMessage = document.getElementById('statusMessage');
    
    statusMessage.textContent = 'Installing pandas and dependencies...';
    updateStepStatus('step0', 'Installing required Python packages...');
    
    try {
        // First ensure micropip is available
        await pyodide.loadPackage('micropip');
        
        // Install required packages using micropip
        await pyodide.runPythonAsync(`
            import micropip
            await micropip.install([
                'pandas',
                'numpy',
                'python-dateutil',
                'pytz',
                'openpyxl',
                'et-xmlfile',
                'jdcal'
            ])
        `);
        
        updateStepStatus('step0', 'Required packages installed successfully.');
        statusMessage.textContent = 'Python packages installed successfully.';
        return true;
    } catch (e) {
        updateStepStatus('step0', `Error installing packages: ${e.message}`, true);
        statusMessage.innerHTML = `<span class="error">Package installation error: ${e.message}</span>`;
        console.error('Package installation error:', e);
        return false;
    }
}