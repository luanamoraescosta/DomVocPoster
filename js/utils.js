// utils.js
let pyodideInstance = null;

/* =============================
   Section Creation
   ============================= */
export function addSection(id, title, description, code) {
    const container = document.getElementById('notebook');

    const sec = document.createElement('div');
    sec.className = 'section';
    sec.id = id;

    const h2 = document.createElement('h2');
    h2.textContent = title;
    sec.appendChild(h2);

    const p = document.createElement('p');
    p.innerHTML = description;
    sec.appendChild(p);

    const pre = document.createElement('pre');
    const codeEl = document.createElement('code');
    codeEl.textContent = code.trim();
    pre.appendChild(codeEl);
    sec.appendChild(pre);

    // Output container where Pyodide results will appear
    const outDiv = document.createElement('div');
    outDiv.className = 'output';
    outDiv.id = `${id}-output`;

    // Nested output content area (for scroll control)
    const outContent = document.createElement('div');
    outContent.className = 'output-content';
    outDiv.appendChild(outContent);

    sec.appendChild(outDiv);

    // Step status message
    const statusDiv = document.createElement('div');
    statusDiv.className = 'step-status';
    statusDiv.id = `${id}-status`;
    sec.appendChild(statusDiv);

    container.appendChild(sec);
    return sec;
}

/* =============================
   Status Updates
   ============================= */
export function updateStepStatus(stepId, message, isError = false) {
    const statusDiv = document.getElementById(`${stepId}-status`);
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.style.color = isError ? '#e74c3c' : '#666';
    }
}

/* =============================
   Pyodide Instance Management
   ============================= */
export function getPyodideInstance() {
    return pyodideInstance;
}

export function setPyodideInstance(instance) {
    pyodideInstance = instance;
}

/* =============================
   Table Wrapping for Responsive Output
   ============================= */
export function setupTableResponsiveWrapping() {
    const notebookContainer = document.getElementById('notebook');
    if (!notebookContainer) return;

    // Observe for new tables rendered by Pyodide
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    wrapTablesInsideOutput(node);
                }
            });
        });
    });

    // Automatically wrap tables already present or added later
    function wrapTablesInsideOutput(element) {
        const tables = element.querySelectorAll('table');
        tables.forEach(table => {
            // Skip if already wrapped
            if (table.closest('.table-scroll-container')) return;

            // Find nearest output box
            const output = table.closest('.output');
            if (!output) return; // only wrap inside outputs

            // Find or create .output-content inside .output
            let outContent = output.querySelector('.output-content');
            if (!outContent) {
                outContent = document.createElement('div');
                outContent.className = 'output-content';
                // Move existing table into new content wrapper
                output.appendChild(outContent);
            }

            // Create scroll container
            const scrollContainer = document.createElement('div');
            scrollContainer.className = 'table-scroll-container';
            outContent.appendChild(scrollContainer);

            // Move the table inside the scroll container
            scrollContainer.appendChild(table);

            // Add an optional caption/status bar
            const caption = document.createElement('div');
            caption.className = 'table-status';
            scrollContainer.insertBefore(caption, table);

            updateTableCaption(table, caption);

            // Watch for resizing to update caption info
            const resizeObserver = new ResizeObserver(() => {
                updateTableCaption(table, caption);
            });
            resizeObserver.observe(table);
        });
    }

    // Update the caption with table dimensions
    function updateTableCaption(table, captionElement) {
        if (!table || !captionElement) return;
        const rows = table.rows.length - 1; // excluding header
        const cols = table.rows[0]?.cells.length || 0;

        const container = table.closest('.table-scroll-container');
        const visibleWidth = container?.clientWidth || 0;
        const tableWidth = table.clientWidth;

        let statusText = `${rows} rows × ${cols} columns`;
        if (tableWidth > visibleWidth) {
            statusText += ' • Scroll horizontally →';
            container.classList.add('has-overflow');
        } else {
            container.classList.remove('has-overflow');
        }

        captionElement.textContent = statusText;
    }

    // Observe the notebook for new output
    observer.observe(notebookContainer, { childList: true, subtree: true });

    // Process existing tables at startup
    wrapTablesInsideOutput(notebookContainer);

    return observer;
}

export function setupNotebookIndex() {
    const notebook = document.getElementById('notebook');
    const indexContent = document.getElementById('index-content');
    
    if (!notebook || !indexContent) {
        console.error('Notebook or index container not found');
        return;
    }
    
    // Create a map to track section visibility
    const sectionVisibility = new Map();
    
    // Function to update the index
    function updateIndex() {
        // Clear current index
        indexContent.innerHTML = '';
        
        // Get all sections
        const sections = notebook.querySelectorAll('.section');
        
        if (sections.length === 0) {
            indexContent.innerHTML = '<div class="index-item">No sections yet</div>';
            return;
        }
        
        // Create index items
        sections.forEach(section => {
            const id = section.id;
            const titleElement = section.querySelector('h2');
            
            if (!titleElement) return;
            
            const title = titleElement.textContent;
            
            // Create index item
            const indexItem = document.createElement('div');
            indexItem.className = 'index-item';
            
            // Create link
            const link = document.createElement('a');
            link.href = `#${id}`;
            link.textContent = title;
            
            // Add click handler for smooth scrolling
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.getElementById(id);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            });
            
            indexItem.appendChild(link);
            indexContent.appendChild(indexItem);
            
            // Initialize visibility tracking
            sectionVisibility.set(id, false);
        });
    }
    
    // Function to update active section based on scroll position
    function updateActiveSection() {
        const sections = notebook.querySelectorAll('.section');
        let closestSection = null;
        let closestDistance = Infinity;
        
        sections.forEach(section => {
            const rect = section.getBoundingClientRect();
            const distance = Math.abs(rect.top);
            
            if (rect.top <= 100 && distance < closestDistance) {
                closestDistance = distance;
                closestSection = section;
            }
        });
        
        // Update active state
        notebook.querySelectorAll('.index-item').forEach(item => {
            item.classList.remove('active');
        });
        
        if (closestSection) {
            const activeLink = document.querySelector(`.index-item a[href="#${closestSection.id}"]`);
            if (activeLink) {
                const activeItem = activeLink.closest('.index-item');
                if (activeItem) {
                    activeItem.classList.add('active');
                }
            }
        }
    }
    
    // Set up MutationObserver to watch for new sections
    const observer = new MutationObserver(mutations => {
        let sectionsAdded = false;
        
        mutations.forEach(mutation => {
            if (mutation.addedNodes) {
                for (let i = 0; i < mutation.addedNodes.length; i++) {
                    const node = mutation.addedNodes[i];
                    if (node.nodeType === 1 && node.classList && node.classList.contains('section')) {
                        sectionsAdded = true;
                        break;
                    }
                }
            }
        });
        
        if (sectionsAdded) {
            updateIndex();
        }
    });
    
    // Start observing the notebook for new sections
    observer.observe(notebook, {
        childList: true,
        subtree: false
    });
    
    // Initial index build
    updateIndex();
    
    // Set up scroll tracking for active section
    window.addEventListener('scroll', () => {
        requestAnimationFrame(updateActiveSection);
    });
    
    // Initial active section check
    updateActiveSection();
    
    return {
        updateIndex,
        updateActiveSection,
        observer
    };
}

// Add this function to utils.js
export function addLineNumbersToCodeBlocks() {
  document.querySelectorAll('pre').forEach(pre => {
    // Skip if already processed
    if (pre.dataset.lineNumbers) return;
    
    // Only process code blocks that don't already have line numbers
    if (pre.querySelector('span')) return;
    
    pre.dataset.lineNumbers = 'true';
    
    // Wrap each line in a span
    const lines = pre.textContent.split('\n');
    pre.innerHTML = '';
    
    lines.forEach(line => {
      if (line.trim() !== '') {
        const span = document.createElement('span');
        span.textContent = line;
        pre.appendChild(span);
      } else {
        pre.appendChild(document.createElement('br'));
      }
    });
  });
}

// Then in your main.js, after setting up table wrapping:
export function initializeApp() {
  setupTableResponsiveWrapping();
  setupNotebookIndex();
  
  // Add line numbers to code blocks
  addLineNumbersToCodeBlocks();
  
  // Set up mutation observer to handle dynamically added code blocks
  const observer = new MutationObserver(() => {
    addLineNumbersToCodeBlocks();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Rest of your initialization code...
}