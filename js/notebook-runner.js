// notebook-runner.js
import { addSection, updateStepStatus, getPyodideInstance } from './utils.js';
import { loadExcelFiles } from './file-loader.js';
import { installPythonPackages } from './package-installer.js';

export async function runNotebook() {
    const pyodide = getPyodideInstance();
    const statusMessage = document.getElementById('statusMessage');
    const notebookContainer = document.getElementById('notebook');
    notebookContainer.innerHTML = ''; // Clear previous runs

    
    try {
        // Step 0: Install required packages
        updateStepStatus('step0', 'Installing required Python packages...');
        const packagesInstalled = await installPythonPackages();
        if (!packagesInstalled) {
            throw new Error('Failed to install required Python packages');
        }
        
        // Check if data files are available
        updateStepStatus('step1', 'Checking for data files...');
        const hasDataFiles = await loadExcelFiles();
        if (!hasDataFiles) {
            statusMessage.innerHTML = '<span class="error">Error: Required data files not found. Please make sure they are in the correct location in your GitHub repository.</span>';
            updateStepStatus('step1', 'Error: Data files not found', true);
            return;
        }
        updateStepStatus('step1', 'Data files loaded successfully.');
        
        /* Step 1: Define the paths to the source Excel files */
        addSection(
            'step1',
            '1. Define the paths to the source Excel files',
            'The notebook expects the following folder structure (relative to this HTML file):' +
            '<pre>project_root/\n' +
            '│\n' +
            '├─ data/\n' +
            '│   └─ KlosterDBExports/\n' +
            '│       ├─ gs_monastery.xlsx\n' +
            '│       ├─ gs_monastery_location.xlsx\n' +
            '│       └─ gs_places.xlsx\n' +
            '└─ index.html</pre>',
            'DATA_ROOT = "data/KlosterDBExports"\n' +
            'MONASTERY_XLSX   = f"{DATA_ROOT}/gs_monastery.xlsx"\n' +
            'LOCATION_XLSX    = f"{DATA_ROOT}/gs_monastery_location.xlsx"\n' +
            'PLACES_XLSX      = f"{DATA_ROOT}/gs_places.xlsx"'
        );
        
        await pyodide.runPythonAsync(`
            DATA_ROOT = "/data/KlosterDBExports"
            MONASTERY_XLSX   = f"{DATA_ROOT}/gs_monastery.xlsx"
            LOCATION_XLSX    = f"{DATA_ROOT}/gs_monastery_location.xlsx"
            PLACES_XLSX      = f"{DATA_ROOT}/gs_places.xlsx"
`);
        document.getElementById('step1-output').textContent = 'Path variables created.';
        updateStepStatus('step1', 'Path variables created successfully.');

        /* Step 2: Load the two Excel sheets into pandas DataFrames */
        const step2 = addSection(
            'step2',
            '2. Load the two Excel sheets into pandas DataFrames',
            'We read the .xlsx files with pandas.read_excel.',
            'import pandas as pd\n\n' +
            'gs_monastery = pd.read_excel(MONASTERY_XLSX, engine="openpyxl")\n' +
            'gs_monastery_location = pd.read_excel(LOCATION_XLSX, engine="openpyxl")\n\n' +
            'print("Monastery table (first 5 rows):")\n' +
            'display(gs_monastery.head())\n\n' +
            'print("\\nMonastery-location table (first 5 rows):")\n' +
            'display(gs_monastery_location.head())'
        );
        
        updateStepStatus('step2', 'Loading Excel files...');
        
        try {
            await pyodide.runPythonAsync(`
                import pandas as pd
                gs_monastery = pd.read_excel(MONASTERY_XLSX, engine="openpyxl")
                gs_monastery_location = pd.read_excel(LOCATION_XLSX, engine="openpyxl")

                # Para depuração, imprimir os caminhos
                print(f"Carregando arquivo monastery de: {MONASTERY_XLSX}")
                print(f"Carregando arquivo location de: {LOCATION_XLSX}")

            `);
            
            const out2a = await pyodide.runPythonAsync(`
                gs_monastery.head().to_html()
            `);
            const out2b = await pyodide.runPythonAsync(`
                gs_monastery_location.head().to_html()
            `);
            document.getElementById('step2-output').innerHTML = out2a + out2b;
            updateStepStatus('step2', 'Excel files loaded successfully.');
        } catch (e) {
            const errorMsg = `Error loading Excel files: ${e.message}`;
            document.getElementById('step2-output').innerHTML = 
                `<div class="error">${errorMsg}</div>`;
            updateStepStatus('step2', errorMsg, true);
            throw e;
        }

        /* Step 3: Merge the two tables (LEFT JOIN) */
        addSection(
            'step3',
            '3. Merge the two tables (LEFT JOIN)',
            'We keep every row from the location table and bring in the matching monastery data using the columns gsn_id (location) and id_gsn (monastery).',
            'merged = pd.merge(\n' +
            '    gs_monastery_location,\n' +
            '    gs_monastery,\n' +
            '    left_on="gsn_id",\n' +
            '    right_on="id_gsn",\n' +
            '    how="left",\n' +
            '    suffixes=("_loc", "_mon")\n' +
            ')\n\n' +
            'print("Merged table (first 5 rows):")\n' +
            'display(merged.head())'
        );
        
        updateStepStatus('step3', 'Merging tables...');
        
        await pyodide.runPythonAsync(`
            merged = pd.merge(
                gs_monastery_location,
                gs_monastery,
                left_on="gsn_id",
                right_on="id_gsn",
                how="left",
                suffixes=("_loc", "_mon")
            )
        `);
        
        const out3 = await pyodide.runPythonAsync(`
            merged.head().to_html()
        `);
        document.getElementById('step3-output').innerHTML = out3;
        updateStepStatus('step3', 'Tables merged successfully.');

        /* Step 4: Keep only rows whose status is "Online" */
        addSection(
            'step4',
            '4. Keep only rows whose status is "Online"',
            'FactGrid only wants active entries.',
            'online = merged[merged["status"] == "Online"].copy()\n\n' +
            'print(f"Rows before filtering: {len(merged)}")\n' +
            'print(f"Rows after keeping only \'Online\': {len(online)}")'
        );
        
        updateStepStatus('step4', 'Filtering online entries...');
        
        await pyodide.runPythonAsync(`
            online = merged[merged["status"] == "Online"].copy()
        `);
        
        const out4 = await pyodide.runPythonAsync(`
            f"Rows before filtering: {len(merged)}\\nRows after keeping only \'Online\': {len(online)}"
        `);
        document.getElementById('step4-output').textContent = out4;
        updateStepStatus('step4', 'Online entries filtered successfully.');

        /* Step 5: Drop columns that are not needed for the upload */
        addSection(
            'step5',
            '5. Drop columns that are not needed for the upload',
            'The Access export contains many bookkeeping columns. We remove them only if they exist (some older exports may miss a column).',
            'drop_columns = [\n' +
            '    "relocated", "comment", "main_location", "diocese_id", "id_monastery",\n' +
            '    "date_created", "created_by_user", "note", "patrocinium", "selection",\n' +
            '    "processing_status", "gs_persons", "selection_criteria", "last_change",\n' +
            '    "changed_by_user", "founder"\n' +
            ']\n\n' +
            'existing_to_drop = [c for c in drop_columns if c in online.columns]\n' +
            'online_clean = online.drop(columns=existing_to_drop)\n\n' +
            'print(f"Dropped {len(existing_to_drop)} columns that were present.")\n' +
            'print("Remaining columns:")\n' +
            'display(pd.Series(online_clean.columns))'
        );
        
        updateStepStatus('step5', 'Dropping unnecessary columns...');
        
        await pyodide.runPythonAsync(`
            drop_columns = [
                "relocated", "comment", "main_location", "diocese_id", "id_monastery",
                "date_created", "created_by_user", "note", "patrocinium", "selection",
                "processing_status", "gs_persons", "selection_criteria", "last_change",
                "changed_by_user", "founder"
            ]
            
            existing_to_drop = [c for c in drop_columns if c in online.columns]
            online_clean = online.drop(columns=existing_to_drop)
        `);
        
        const out5a = await pyodide.runPythonAsync(`
            f"Dropped {len(existing_to_drop)} columns that were present."
        `);
        const out5b = await pyodide.runPythonAsync(`
            pd.Series(online_clean.columns).to_frame(name="Remaining columns").to_html()
        `);
        document.getElementById('step5-output').innerHTML = out5a + out5b;
        updateStepStatus('step5', 'Unnecessary columns dropped successfully.');

        /* Step 6: Build the German label (Lde) for the building-complex items */
        addSection(
            'step6',
            '6. Build the German label (Lde) for the building-complex items',
            'The label must follow the pattern:\n' +
            'Gebäudekomplex <monastery_name> [(<location_name>)]\n\n' +
            'If location_name is missing we omit the parentheses.',
            'def safe_str(x):\n' +
            '    return "" if pd.isna(x) else str(x)\n\n' +
            'online_clean["Lde"] = (\n' +
            '    "Gebäudekomplex " +\n' +
            '    online_clean["monastery_name"].apply(safe_str) +\n' +
            '    " (" +\n' +
            '    online_clean["location_name"].apply(safe_str) +\n' +
            '    ")"\n' +
            ')\n\n' +
            'online_clean["Lde"] = online_clean["Lde"].str.replace(r"\\s\$\$", "", regex=True)\n\n' +
            'print("Sample of the new label column:")\n' +
            'display(online_clean[["monastery_name", "location_name", "Lde"]].head())'
        );
        
        updateStepStatus('step6', 'Building German labels...');
        
        await pyodide.runPythonAsync(`
            def safe_str(x):
                return "" if pd.isna(x) else str(x)
            
            online_clean["Lde"] = (
                "Gebäudekomplex " +
                online_clean["monastery_name"].apply(safe_str) +
                " (" +
                online_clean["location_name"].apply(safe_str) +
                ")"
            )
            
            online_clean["Lde"] = online_clean["Lde"].str.replace(r"\\s\$\$", "", regex=True)
        `);
        
        const out6 = await pyodide.runPythonAsync(`
             online_clean[["monastery_name","location_name","Lde"]].head().to_html()
        `);
        document.getElementById('step6-output').innerHTML = out6;
        updateStepStatus('step6', 'German labels built successfully.');

        /* Step 7: Preview the final table (what will be uploaded) */
        addSection(
            'step7',
            '7. Preview the final table (what will be uploaded)',
            'Only the columns we really need are shown.',
            'cols_of_interest = [\n' +
            '    "Lde", "monastery_name", "location_name", "latitude", "longitude",\n' +
            '    "location_begin_tpq", "location_end_tpq",\n' +
            '    "location_begin_note", "location_end_note"\n' +
            ']\n\n' +
            'display(online_clean[cols_of_interest].head(10))'
        );
        
        updateStepStatus('step7', 'Preparing final table...');
        
        const out7 = await pyodide.runPythonAsync(`
            cols_of_interest = [
                "Lde", "monastery_name", "location_name", "latitude", "longitude",
                "location_begin_tpq", "location_end_tpq",
                "location_begin_note", "location_end_note"
            ]
            online_clean[cols_of_interest].head(10).to_html()
        `);
        document.getElementById('step7-output').innerHTML = out7;
        updateStepStatus('step7', 'Final table prepared successfully.');

        /* Step 8: Generate QuickStatements for FactGrid */
        addSection(
            'step8',
            '8. Generate QuickStatements for FactGrid',
            'Each building-complex becomes a block of QuickStatements. Only fields that actually have a value are added.',
            'def qs_escape(text: str) -> str:\n' +
            '    """Escape double quotes for QuickStatements (\\" → \\\\\\" )."""\n' +
            '    return text.replace(\'"\', r\'\\\\\\"\')\n\n' +
            'quickstatements = []\n\n' +
            'for _, row in online_clean.iterrows():\n' +
            '    qs = "CREATE\\n"\n' +
            '    qs += f\'Len: "{qs_escape(row["Lde"])}"\\n\'\n' +
            '    qs += \'Den: "Gebäudekomplex eines Klosters aus der Klosterdatenbank"\\n\'\n\n' +
            '    # Coordinates (P6) - only if both latitude and longitude are present\n' +
            '    if pd.notna(row["latitude"]) and pd.notna(row["longitude"]):\n' +
            '        qs += f"P6: {row[\'latitude\']}/{row[\'longitude\']}\\n"\n\n' +
            '    # Begin year (P58)\n' +
            '    if pd.notna(row["location_begin_tpq"]):\n' +
            '        qs += f"P58: {int(float(row[\'location_begin_tpq\']))}\\n"\n\n' +
            '    # End year (P59)\n' +
            '    if pd.notna(row["location_end_tpq"]):\n' +
            '        qs += f"P59: {int(float(row[\'location_end_tpq\']))}\\n"\n\n' +
            '    # Notes (S29) - escaped\n' +
            '    if pd.notna(row["location_begin_note"]):\n' +
            '        qs += f\'S29: "{qs_escape(str(row["location_begin_note"]))}"\\n\'\n\n' +
            '    if pd.notna(row["location_end_note"]):\n' +
            '        qs += f\'S29: "{qs_escape(str(row["location_end_note"]))}"\\n\'\n\n' +
            '    quickstatements.append(qs)\n\n' +
            '# Show the first two blocks as a sanity check\n' +
            'first_two = "\\n---\\n".join(quickstatements[:2])\n' +
            'print(first_two)'
        );
        
        updateStepStatus('step8', 'Generating QuickStatements...');
        
        await pyodide.runPythonAsync(`
            def qs_escape(text: str) -> str:
                return text.replace('"', r'\\"')
            
            quickstatements = []
            
            for _, row in online_clean.iterrows():
                qs = "CREATE\\n"
                qs += f'Len: "{qs_escape(row["Lde"])}"\\n'
                qs += 'Den: "Gebäudekomplex eines Klosters aus der Klosterdatenbank"\\n'
            
                # Coordinates (P6)
                if pd.notna(row["latitude"]) and pd.notna(row["longitude"]):
                    qs += f"P6: {row['latitude']}/{row['longitude']}\\n"
            
                # Begin year (P58)
                if pd.notna(row["location_begin_tpq"]):
                    qs += f"P58: {int(float(row['location_begin_tpq']))}\\n"
            
                # End year (P59)
                if pd.notna(row["location_end_tpq"]):
                    qs += f"P59: {int(float(row['location_end_tpq']))}\\n"
            
                # Notes (S29)
                if pd.notna(row["location_begin_note"]):
                    qs += f'S29: "{qs_escape(str(row["location_begin_note"]))}"\\n'
            
                if pd.notna(row["location_end_note"]):
                    qs += f'S29: "{qs_escape(str(row["location_end_note"]))}"\\n'
            
                quickstatements.append(qs)
        `);
        
        const out8 = await pyodide.runPythonAsync(`
            first_two = "\\n---\\n".join(quickstatements[:2])
            first_two
        `);
        document.getElementById('step8-output').textContent = out8;
        updateStepStatus('step8', 'QuickStatements generated successfully.');

        /* Step 9: Save the QuickStatements to a text file */
        addSection(
            'step9',
            '9. Save the QuickStatements to a text file',
            'Click the button below to download the file. The file can be pasted directly into the FactGrid QuickStatements editor.',
            'OUTPUT_FILE = "monastery_buildings.quickstatements.txt"\n' +
            'with open(OUTPUT_FILE, "w", encoding="utf-8") as f:\n' +
            '    f.write("\\n\\n".join(quickstatements))\n\n' +
            'print(f"QuickStatements written to {OUTPUT_FILE}")\n' +
            'print(f"Total items created: {len(quickstatements)}")'
        );
        
        updateStepStatus('step9', 'Saving QuickStatements file...');
        
        await pyodide.runPythonAsync(`
            OUTPUT_FILE = "monastery_buildings.quickstatements.txt"
            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                f.write("\\n\\n".join(quickstatements))
        `);

        
        const out9 = await pyodide.runPythonAsync(`
            f"QuickStatements written to monastery_buildings.quickstatements.txt\\nTotal items created: {len(quickstatements)}"
        `);
        document.getElementById('step9-output').textContent = out9;
        updateStepStatus('step9', 'QuickStatements file saved successfully.');

        // Add the download button
        const downloadBtn = document.createElement('button');
        downloadBtn.textContent = 'Download QuickStatements';
        downloadBtn.id = 'downloadBtn';
        document.getElementById('step9').appendChild(downloadBtn);

        downloadBtn.addEventListener('click', async () => {
            try {
                const data = await pyodide.FS.readFile('monastery_buildings.quickstatements.txt', {encoding: 'utf8'});
                const blob = new Blob([data], {type: 'text/plain'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'monastery_buildings.quickstatements.txt';
                a.click();
                URL.revokeObjectURL(url);
                statusMessage.textContent = 'Download started successfully.';
            } catch (e) {
                statusMessage.innerHTML = `<span class="error">Error creating download: ${e.message}</span>`;
                console.error('Download error:', e);
            }
        });
        
        statusMessage.textContent = 'Notebook execution completed successfully.';
        
    } catch (e) {
        statusMessage.innerHTML = `<span class="error">Execution failed: ${e.message}</span>`;
        console.error('Notebook execution error:', e);
        throw e;
    }
}