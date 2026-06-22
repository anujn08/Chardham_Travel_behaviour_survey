// --- GLOBAL DATA (No DOM dependency) ---
// Choice cards are loaded from main_haul.csv and last_mile.csv.
let mainHaulTasks = {};
let lastMileTasks = {};
let choiceDataSource = "csv";

const fallbackMainHaulCsv = `Dham,Task,Cost_A,Time_A,Comfort_A,Reliability_A,Transfers_A,Cost_B,Time_B,Comfort_B,Reliability_B,Transfers_B,Cost_C,Time_C,Comfort_C,Reliability_C,Transfers_C,Alt_A,Alt_B,Alt_C
Kedarnath,1,500,4.5,High,High,1,600,8,Medium,Medium,1,800,3.5,Luxury,Very High,0,Railway,Bus/MiniBus,Private Car
Kedarnath,2,1050,6,Medium,Medium,1,600,4.5,High,High,1,4.55,10,Low,Low,0,Bus/MiniBus,Railway,Shared Taxi
Badrinath,1,500,4.5,High,High,1,600,8,Medium,Medium,1,800,3.5,Luxury,Very High,0,Railway,Bus/MiniBus,Private Car
Badrinath,2,1050,6,Medium,Medium,1,600,4.5,High,High,1,4.55,10,Low,Low,0,Bus/MiniBus,Railway,Shared Taxi
Hemkund Sahib,1,500,4.5,High,High,1,600,8,Medium,Medium,1,800,3.5,Luxury,Very High,0,Railway,Bus/MiniBus,Private Car
Hemkund Sahib,2,1050,6,Medium,Medium,1,600,4.5,High,High,1,4.55,10,Low,Low,0,Bus/MiniBus,Railway,Shared Taxi`;

const fallbackLastMileCsv = `Dham,Task,Cost_A,Time_A,Comfort_A,Reliability_A,Transfers_A,Cost_B,Time_B,Comfort_B,Reliability_B,Transfers_B,Cost_C,Time_C,Comfort_C,Reliability_C,Transfers_C,Alt_A,Alt_B,Alt_C
Kedarnath,1,1500,1.5,Very High,High,0,800,2.5,Medium,Medium,0,0,4,Low,Low,0,Ropeway,Pony,Trek
Kedarnath,2,1000,2,High,Medium,0,2500,1,Luxury,Very High,0,0,5,Low,Low,0,Palki,Helicopter,Trek
Yamunotri,1,1500,1.5,Very High,High,0,800,2.5,Medium,Medium,0,0,4,Low,Low,0,Ropeway,Pony,Trek
Yamunotri,2,1000,2,High,Medium,0,2500,1,Luxury,Very High,0,0,5,Low,Low,0,Palki,Helicopter,Trek
Hemkund Sahib,1,1500,1.5,Very High,High,0,800,2.5,Medium,Medium,0,0,4,Low,Low,0,Ropeway,Pony,Trek
Hemkund Sahib,2,1000,2,High,Medium,0,2500,1,Luxury,Very High,0,0,5,Low,Low,0,Palki,Helicopter,Trek`;

// --- GLOBAL VARIABLES ---
// These are declared globally so all functions can access them,
// but they will be *assigned* their values once the DOM is ready.
let currentTab = 0;
let responses = [];
let primaryModeRowIndex = 0;
let lastMileRowIndex = 0; // Note: This index isn't used, rows are managed by Dham name
let restLocationRowIndex = 0;
let choiceBlock = null;
let selectedChoiceTaskNumbersBySet = {};

// Change this number when you want each respondent to see more/fewer cards per visited Dham.
// Example: 4 means each respondent sees 4 cards per visited Dham.
const CHOICE_CARDS_PER_BLOCK = 4;

// "random" gives each respondent a random combination of cards.
// "sequential" gives block 1 tasks 1-4, block 2 tasks 5-8, etc.
const CHOICE_BLOCK_MODE = "random";

// Optional exact block setup. Leave as null to auto-build blocks from the CSV task order.
// Example:
// const CUSTOM_CHOICE_BLOCK_TASKS = {
//     1: [1, 4, 7],
//     2: [2, 5, 8],
//     3: [3, 6]
// };
const CUSTOM_CHOICE_BLOCK_TASKS = null;

let form = null;
let tableBody = null;
let pages = null;
let steps = null;
let pageBackground = null;
let googleSheetTarget = null;
let primaryModeTableBody = null;
let lastMileTableBody = null;
let stayDurationTableBody = null;
let restLocationTableBody = null;
let dhamCheckboxes = null;
let choiceBlockInput = null;
let googleTranslateElement = null;
let floatingTranslateMount = null;
let consentTranslateMount = null;
let surveyStartTimestampInput = null;
let surveySubmitTimestampInput = null;
let surveyCompletionSecondsInput = null;


// --- CORE FUNCTIONS (Called from HTML or Event Listeners) ---
// These are all defined globally so your HTML `onclick="..."` attributes can find them.

/**
 * [FIX #1]
 * This function is corrected. It now hides ALL pages first,
 * then shows ONLY the one specified by 'n'. This fixes the
 * "pages showing on top of each other" bug.
 */
function showTab(n) {
    if (!pages || !steps || !pageBackground) {
        console.error("showTab called before DOM was ready.");
        return; 
    }

    // Hide ALL pages
    pages.forEach((page, index) => {
        page.style.display = "none";
    });

    // Show ONLY the current page
    pages[n].style.display = "block";

    updateProgressStep(n);
    updateBackground(n);
    updateTranslatePlacement(n);

    // Navigation buttons logic
    const prevBtn = pages[n].querySelector('button[onclick="nextPrev(-1)"]');
    const nextBtn = pages[n].querySelector('button[onclick="nextPrev(1)"]');
    const submitBtn = pages[n].querySelector('#submitBtn');
    
    // Special case for Consent page (Page 0)
    if (n === 0) {
        if(prevBtn) prevBtn.style.display = "none";
    } else {
        if(prevBtn) prevBtn.style.display = "inline-block"; // Ensure prev button is visible on other pages
    }

    // Special case for Thank You page (Page 6)
    if (n === pages.length - 1) {
        if(nextBtn) nextBtn.style.display = "none";
        if(submitBtn) submitBtn.style.display = "none";
    }
}

function updateTranslatePlacement(pageIndex) {
    if (!googleTranslateElement || !floatingTranslateMount || !consentTranslateMount) return;

    if (pageIndex === 0) {
        if (googleTranslateElement.parentElement !== consentTranslateMount) {
            consentTranslateMount.appendChild(googleTranslateElement);
        }
    } else if (googleTranslateElement.parentElement !== floatingTranslateMount) {
        floatingTranslateMount.appendChild(googleTranslateElement);
    }
}

function nextPrev(n) {
    // Hide current page
    pages[currentTab].style.display = "none";
    
    // Validation: Only validate if moving forward (n=1)
    if (n > 0) {
        if (!validatePage(currentTab)) {
            // If validation fails, show current tab again and stop
            pages[currentTab].style.display = "block";
            return false;
        }

        if (currentTab === 0) {
            initializeSurveyTiming();
        }
    }

    // Move to next/prev tab
    currentTab = currentTab + n;

    // Check if we are at the submission step.
    if (currentTab === pages.length - 1) { // If this is the Thank You page
        // We assume validation passed on the previous page.
        handleFormSubmit();
    }
    
    // Show the new page
    showTab(currentTab);
}

function validatePage(n) {
    let valid = true;
    if (!pages) return false; // Safety check
    const page = pages[n];
    
    // 1. Check all 'required' inputs (text, select, etc.)
    const requiredInputs = page.querySelectorAll('input[required], select[required], textarea[required]');
    
    requiredInputs.forEach(el => {
        // Clear previous invalid visual cues
        el.style.border = '1px solid #ccc';
        
        if (el.type === 'radio' || el.type === 'checkbox') {
            // Radio/Checkbox validation is handled by group below
        } else if (el.type !== 'checkbox' && el.value.trim() === "") {
            valid = false;
            el.style.border = '2px solid red'; // Highlight invalid field
        } else if (el.type === 'number' && (el.value === "" || (el.min && parseFloat(el.value) < parseFloat(el.min)))) {
            valid = false;
            el.style.border = '2px solid red'; // Highlight invalid field
        }
    });

    // 2. Check Radio groups explicitly
    const radioGroups = page.querySelectorAll('input[type="radio"][required]');
    const radioGroupNames = new Set(Array.from(radioGroups).map(r => r.name));
    
    radioGroupNames.forEach(name => {
        const groupContainer = page.querySelector(`input[name="${name}"]`)?.closest('table, div.dham-block');
        if (groupContainer) {
            groupContainer.style.border = 'none'; // Clear previous error
        }

        if (!page.querySelector(`input[name="${name}"]:checked`)) {
            valid = false;
            // Add visual cue
            if(groupContainer) {
                groupContainer.style.border = '2px solid red';
            }
        }
    });
    
    // 3. Check Checkbox groups for A4.2 (Last Mile Mode)
    if (page.id === 'page-2-B') {
        if (!validateGroupComposition()) {
            valid = false;
        }

        const currentVisitCheckboxes = page.querySelectorAll('.current-dham-checkbox');
        const hasCurrentVisit = Array.from(currentVisitCheckboxes).some(cb => cb.checked);
        const visitHistoryTable = currentVisitCheckboxes[0]?.closest('table');
        if (visitHistoryTable) {
            visitHistoryTable.style.border = 'none';
        }
        if (!hasCurrentVisit) {
            valid = false;
            if (visitHistoryTable) {
                visitHistoryTable.style.border = '2px solid red';
            }
        }

        const sequenceSelects = Array.from(page.querySelectorAll('select[name^="dhamSequence_"]'));
        const selectedSequence = sequenceSelects.map(select => select.value).filter(Boolean);
        const hasDuplicateSequence = selectedSequence.length !== new Set(selectedSequence).size;
        sequenceSelects.forEach(select => {
            select.style.border = '1px solid #ccc';
            if (hasDuplicateSequence && select.value) {
                select.style.border = '2px solid red';
            }
        });
        if (hasDuplicateSequence) {
            valid = false;
        }

    }

    if (!valid) {
        alert('Please fill out all required fields. Invalid fields are highlighted in red.');
    }
    
    return valid;
}

function updateProgressStep(n) {
    if (!steps) return;
    steps.forEach((step, index) => {
        if (index === n) {
            step.classList.add("active");
        } else {
            step.classList.remove("active");
        }
    });
}

function updateBackground(n) {
    if (!pageBackground) return;
    pageBackground.className = `page-background bg-${n}`;
}

// --- DCE Functions ---
function getVisitedDhams() {
    if (!dhamCheckboxes) return [];
    const visitedDhams = [];
    dhamCheckboxes.forEach(cb => {
        if (cb.checked) {
            visitedDhams.push(cb.dataset.dham);
        }
    });
    return visitedDhams;
}

function parseCsv(text) {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"' && insideQuotes && nextChar === '"') {
            currentCell += '"';
            i++;
        } else if (char === '"') {
            insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
            currentRow.push(currentCell);
            currentCell = '';
        } else if ((char === '\n' || char === '\r') && !insideQuotes) {
            if (char === '\r' && nextChar === '\n') i++;
            currentRow.push(currentCell);
            if (currentRow.some(cell => cell.trim() !== '')) rows.push(currentRow);
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += char;
        }
    }

    currentRow.push(currentCell);
    if (currentRow.some(cell => cell.trim() !== '')) rows.push(currentRow);
    if (rows.length < 2) return [];

    const headers = rows[0].map(header => header.trim());
    return rows.slice(1).map(row => {
        const record = {};
        headers.forEach((header, index) => {
            record[header] = normalizeCsvValue(row[index] || '');
        });
        return record;
    }).filter(record => record.Dham);
}

function normalizeCsvValue(value) {
    const trimmedValue = String(value).trim();
    if (trimmedValue !== '' && !Number.isNaN(Number(trimmedValue))) {
        return Number(trimmedValue);
    }
    return trimmedValue;
}

function groupTasksByDham(rows) {
    return rows.reduce((groupedTasks, row) => {
        const dham = row.Dham;
        if (!groupedTasks[dham]) groupedTasks[dham] = [];
        groupedTasks[dham].push(row);
        return groupedTasks;
    }, {});
}

async function loadChoiceTaskCsv(fileName, fallbackCsv) {
    try {
        const response = await fetch(fileName, { cache: 'no-store' });
        if (!response.ok) throw new Error(`${fileName} returned ${response.status}`);
        const csvText = await response.text();
        return { tasks: groupTasksByDham(parseCsv(csvText)), source: fileName };
    } catch (error) {
        console.warn(`Could not load ${fileName}; using embedded fallback choice-card data.`, error);
        choiceDataSource = 'embedded fallback';
        return { tasks: groupTasksByDham(parseCsv(fallbackCsv)), source: 'embedded fallback' };
    }
}

async function loadChoiceCardData() {
    const [mainHaulResult, lastMileResult] = await Promise.all([
        loadChoiceTaskCsv('main_haul.csv', fallbackMainHaulCsv),
        loadChoiceTaskCsv('last_mile.csv', fallbackLastMileCsv)
    ]);

    mainHaulTasks = mainHaulResult.tasks;
    lastMileTasks = lastMileResult.tasks;

    if (mainHaulResult.source !== 'embedded fallback' && lastMileResult.source !== 'embedded fallback') {
        choiceDataSource = 'csv';
    }

    console.log(`Choice card data loaded from ${choiceDataSource}.`);
}

function assignChoiceBlock() {
    if (CHOICE_BLOCK_MODE === "random" && !CUSTOM_CHOICE_BLOCK_TASKS) {
        selectedChoiceTaskNumbersBySet = parseSavedChoiceTaskMap();
        choiceBlock = "random";
        updateChoiceBlockInput();
        return;
    }

    const totalBlocks = getTotalChoiceBlocks();
    const savedBlock = parseInt(sessionStorage.getItem('charDhamChoiceBlock'), 10);
    if (Number.isInteger(savedBlock) && savedBlock >= 1 && savedBlock <= totalBlocks) {
        choiceBlock = savedBlock;
    } else {
        choiceBlock = Math.floor(Math.random() * totalBlocks) + 1;
        sessionStorage.setItem('charDhamChoiceBlock', String(choiceBlock));
    }

    if (choiceBlockInput) {
        choiceBlockInput.value = String(choiceBlock);
    }
}

function getOrCreateRandomChoiceTaskNumbers(selectionKey, tasks) {
    const availableTaskNumbers = getTaskNumbersFromTasks(tasks);
    const cardsPerBlock = Math.min(
        availableTaskNumbers.length,
        Math.max(1, Number(CHOICE_CARDS_PER_BLOCK) || 1)
    );
    const savedTaskNumbers = selectedChoiceTaskNumbersBySet[selectionKey] || [];

    if (savedTaskNumbers.length === cardsPerBlock && savedTaskNumbers.every(taskNumber => availableTaskNumbers.includes(taskNumber))) {
        return savedTaskNumbers;
    }

    const randomTaskNumbers = shuffleArray(availableTaskNumbers).slice(0, cardsPerBlock).sort((a, b) => a - b);
    selectedChoiceTaskNumbersBySet[selectionKey] = randomTaskNumbers;
    saveChoiceTaskMap();
    updateChoiceBlockInput();
    sessionStorage.removeItem('charDhamChoiceBlock');
    return randomTaskNumbers;
}

function parseSavedChoiceTaskMap() {
    try {
        const savedValue = sessionStorage.getItem('charDhamChoiceTaskMap');
        const parsedValue = savedValue ? JSON.parse(savedValue) : {};
        if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) return {};

        return Object.fromEntries(
            Object.entries(parsedValue).map(([selectionKey, taskNumbers]) => [
                selectionKey,
                Array.isArray(taskNumbers) ? taskNumbers.map(Number).filter(Number.isFinite) : []
            ])
        );
    } catch (error) {
        return {};
    }
}

function saveChoiceTaskMap() {
    sessionStorage.setItem('charDhamChoiceTaskMap', JSON.stringify(selectedChoiceTaskNumbersBySet));
}

function updateChoiceBlockInput() {
    if (!choiceBlockInput) return;

    if (CHOICE_BLOCK_MODE === "random" && !CUSTOM_CHOICE_BLOCK_TASKS) {
        choiceBlockInput.value = `random:${JSON.stringify(selectedChoiceTaskNumbersBySet)}`;
    } else {
        choiceBlockInput.value = String(choiceBlock);
    }
}

function shuffleArray(items) {
    const shuffledItems = [...items];
    for (let i = shuffledItems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledItems[i], shuffledItems[j]] = [shuffledItems[j], shuffledItems[i]];
    }
    return shuffledItems;
}

function getConfiguredTaskBlocks() {
    if (CUSTOM_CHOICE_BLOCK_TASKS && typeof CUSTOM_CHOICE_BLOCK_TASKS === 'object') {
        return Object.entries(CUSTOM_CHOICE_BLOCK_TASKS)
            .map(([blockNumber, taskNumbers]) => ({
                blockNumber: Number(blockNumber),
                taskNumbers: Array.isArray(taskNumbers) ? taskNumbers.map(Number) : []
            }))
            .filter(block => Number.isInteger(block.blockNumber) && block.blockNumber > 0 && block.taskNumbers.length > 0)
            .sort((a, b) => a.blockNumber - b.blockNumber);
    }

    const allTaskNumbers = getAllChoiceTaskNumbers();
    const cardsPerBlock = Math.max(1, Number(CHOICE_CARDS_PER_BLOCK) || 1);
    const blocks = [];

    for (let i = 0; i < allTaskNumbers.length; i += cardsPerBlock) {
        blocks.push({
            blockNumber: blocks.length + 1,
            taskNumbers: allTaskNumbers.slice(i, i + cardsPerBlock)
        });
    }

    return blocks.length > 0 ? blocks : [{ blockNumber: 1, taskNumbers: [] }];
}

function getAllChoiceTaskNumbers() {
    const taskNumbers = new Set();
    [mainHaulTasks, lastMileTasks].forEach(taskGroups => {
        Object.values(taskGroups).forEach(tasks => {
            tasks.forEach(task => {
                const taskNumber = Number(task.Task);
                if (Number.isFinite(taskNumber)) taskNumbers.add(taskNumber);
            });
        });
    });

    return Array.from(taskNumbers).sort((a, b) => a - b);
}

function getTaskNumbersFromTasks(tasks) {
    return Array.from(new Set(
        tasks.map(task => Number(task.Task)).filter(Number.isFinite)
    )).sort((a, b) => a - b);
}

function getTotalChoiceBlocks() {
    return getConfiguredTaskBlocks().length || 1;
}

function getTasksForCurrentBlock(tasks, selectionKey = 'global') {
    if (!Array.isArray(tasks) || tasks.length === 0) return [];

    if (CHOICE_BLOCK_MODE === "random" && !CUSTOM_CHOICE_BLOCK_TASKS) {
        const selectedTaskNumbers = getOrCreateRandomChoiceTaskNumbers(selectionKey, tasks);
        return tasks.filter(task => selectedTaskNumbers.includes(Number(task.Task)));
    }

    const selectedBlock = getConfiguredTaskBlocks()[choiceBlock - 1] || getConfiguredTaskBlocks()[0];
    const blockTasks = tasks.filter(task => selectedBlock.taskNumbers.includes(Number(task.Task)));
    if (blockTasks.length > 0) return blockTasks;

    const fallbackIndex = (choiceBlock - 1) % tasks.length;
    return [tasks[fallbackIndex]];
}

function initializeDCE() {
    const visitedDhams = getVisitedDhams();
    const hasMainHaulChoiceTasks = visitedDhams.some(dham => Array.isArray(mainHaulTasks[dham]) && mainHaulTasks[dham].length > 0);
    const hasLastMileChoiceTasks = visitedDhams.some(dham => Array.isArray(lastMileTasks[dham]) && lastMileTasks[dham].length > 0);
    toggleChoiceArea('mainHaul', hasMainHaulChoiceTasks);
    toggleChoiceArea('lastMile', hasLastMileChoiceTasks);
    
    // C1: Main-Haul Blocks
    Object.keys(mainHaulTasks).forEach(dham => {
        const dhamSlug = dham.replace(/\s/g, '');
        const dhamBlock = document.getElementById(`main-haul-${dhamSlug}-block`);
        const container = document.getElementById(`main-haul-${dhamSlug}-tasks`);
        if (dhamBlock && container) {
            if (visitedDhams.includes(dham)) {
                dhamBlock.style.display = 'block'; 
                const blockTasks = getTasksForCurrentBlock(mainHaulTasks[dham], `main_haul:${dhamSlug}`);
                container.innerHTML = blockTasks.map((task, index) => 
                    generateTaskHTML(task, task.Task || index + 1, 'main_haul')
                ).join('');
            } else {
                dhamBlock.style.display = 'none';
                container.innerHTML = ''; // Clear content
            }
        }
    });

    // C2: Last-Mile Blocks
    Object.keys(lastMileTasks).forEach(dham => {
        const dhamSlug = dham.replace(/\s/g, '');
        const dhamBlock = document.getElementById(`last-mile-${dhamSlug}-block`);
        const container = document.getElementById(`last-mile-${dhamSlug}-tasks`);
        
        if (dhamBlock && container) {
            if (visitedDhams.includes(dham)) {
                dhamBlock.style.display = 'block';
                const blockTasks = getTasksForCurrentBlock(lastMileTasks[dham], `last_mile:${dhamSlug}`);
                container.innerHTML = blockTasks.map((task, index) => 
                    generateTaskHTML(task, task.Task || index + 1, 'last_mile')
                ).join('');
            } else {
                dhamBlock.style.display = 'none';
                container.innerHTML = ''; // Clear content
            }
        }
    });
}

function toggleChoiceArea(area, shouldShow) {
    const idsByArea = {
        mainHaul: [
            'mainHaulChoiceTitle',
            'mainHaulProjectBrief',
            'mainHaulAttributeLegend',
            'mainHaulChoiceInstruction',
            'mainHaulChoiceCard'
        ],
        lastMile: [
            'lastMileChoiceTitle',
            'lastMileProjectBrief',
            'lastMileAttributeLegend',
            'lastMileChoiceInstruction',
            'lastMileChoiceCard',
            'integratedServicePreferences'
        ]
    };
    const noChoiceNoteIdByArea = {
        mainHaul: 'mainHaulNoChoiceNote',
        lastMile: 'lastMileNoChoiceNote'
    };

    (idsByArea[area] || []).forEach(id => {
        const element = document.getElementById(id);
        if (!element) return;
        element.style.display = shouldShow ? '' : 'none';
        element.querySelectorAll('input, select, textarea').forEach(control => {
            if (shouldShow) {
                if (control.dataset.wasRequired === 'true') control.required = true;
            } else {
                if (control.required) control.dataset.wasRequired = 'true';
                control.required = false;
            }
        });
    });

    const noChoiceNote = document.getElementById(noChoiceNoteIdByArea[area]);
    if (noChoiceNote) noChoiceNote.style.display = shouldShow ? 'none' : '';
}

function generateTaskHTML(task, index, segment) {
    const attributes = ['Cost', 'Time', 'Comfort', 'Reliability', 'Transfers'];
    const taskName = `${segment}_${task.Dham.replace(/\s/g, '')}_Task${index}`;
    
    const alternatives = [
        { id: 'A', name: task.Alt_A },
        { id: 'B', name: task.Alt_B },
        { id: 'C', name: task.Alt_C },
    ];

    let tableHTML = `
        <div style="border: 1px solid #ddd; border-radius: 6px; margin-bottom: 20px; overflow-x: auto;">
            <h5 style="background-color: #e6f7ff; padding: 8px; margin: 0; font-size: 1em;">Task ${escapeHTML(index)}: Choose one option.</h5>
            <table class="dce-table">
                <thead>
                    <tr>
                        <th>Attribute</th>
                        <th>Option A: ${escapeHTML(alternatives[0].name)}</th>
                        <th>Option B: ${escapeHTML(alternatives[1].name)}</th>
                        <th>Option C: ${escapeHTML(alternatives[2].name)}</th>
                    </tr>
                </thead>
                <tbody>
    `;

    attributes.forEach(attr => {
        let unit = '';
        let prefix = '';
        if (attr === 'Cost') prefix = '₹';
        else if (attr === 'Time') unit = ' Hours';
        else if (attr === 'Transfers') unit = task[`${attr}_A`] == 1 ? ' Time' : ' Times'; // Handle plural

        // Check if attribute exists for all options (e.g., Transfers might not)
        if (task[`${attr}_A`] !== undefined) {
             tableHTML += `
                <tr>
                    <th>${attr}${attr === 'Transfers' ? ' (No. of stops/changes)' : ''}</th>
                    <td>${prefix}${escapeHTML(task[`${attr}_A`])}${unit}</td>
                    <td>${prefix}${escapeHTML(task[`${attr}_B`])}${unit}</td>
                    <td>${prefix}${escapeHTML(task[`${attr}_C`])}${unit}</td>
                </tr>
            `;
        }
    });

    tableHTML += `
                    <tr class="choice-row">
                        <th>Your Choice</th>
                        <td><label><input type="radio" name="${escapeAttribute(taskName)}" value="A: ${escapeAttribute(alternatives[0].name)}" required/> Select</label></td>
                        <td><label><input type="radio" name="${escapeAttribute(taskName)}" value="B: ${escapeAttribute(alternatives[1].name)}" required/> Select</label></td>
                        <td><label><input type="radio" name="${escapeAttribute(taskName)}" value="C: ${escapeAttribute(alternatives[2].name)}" required/> Select</label></td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
    return tableHTML;
}

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
    return escapeHTML(value);
}

// --- Dynamic Table Functions ---
function getDhamSlug(dham) {
    return String(dham).replace(/\s/g, '');
}

function getMainHaulBaseDestination(dham) {
    const destinationsByDham = {
        Kedarnath: 'Sonprayag',
        Badrinath: 'Badrinath',
        Yamunotri: 'Janki Chatti',
        Gangotri: 'Gangotri',
        'Hemkund Sahib': 'Govindghat'
    };
    return destinationsByDham[dham] || 'Base Town';
}

function getPrimaryModeFieldSuffix(index, dham = '', rowType = 'manual', segmentNumber = 0) {
    if (!dham) return String(index);

    const dhamSlug = getDhamSlug(dham);
    if (rowType === 'segment') {
        return `${dhamSlug}_segment${segmentNumber}`;
    }
    return `${dhamSlug}_route`;
}

function createPrimaryModeRowHTML(index, dham = '', rowType = 'manual', segmentNumber = 0, segmentTotal = 0) {
    const hasFixedDham = Boolean(dham);
    const isSummaryRow = rowType === 'dham';
    const isSegmentRow = rowType === 'segment';
    const dhamSlug = getDhamSlug(dham);
    const rowId = hasFixedDham
        ? isSegmentRow
            ? `primary-row-${dhamSlug}-segment-${segmentNumber}`
            : `primary-row-${dhamSlug}`
        : `primary-row-extra-${index}`;
    const fieldSuffix = getPrimaryModeFieldSuffix(index, dham, rowType, segmentNumber);
    const modeOptions = `<option value="">--Select--</option><option>Bus/MiniBus</option><option>Reserved Taxi/Hired Car</option><option>Own Car</option><option>Own Two-wheeler/Bike</option><option>Shared Jeep/Shared Taxi</option><option>Railway</option><option>Helicopter</option>`;
    const dhamOptions = `<option value="">--Select--</option><option>Kedarnath</option><option>Badrinath</option><option>Gangotri</option><option>Yamunotri</option><option>Hemkund Sahib</option><option>Complete Pilgrimage</option>`;
    const dhamCell = hasFixedDham
        ? `${escapeHTML(dham)}<input type="hidden" name="primaryDham_${fieldSuffix}" value="${escapeAttribute(dham)}">`
        : `<select name="primaryDham_${fieldSuffix}" required>${dhamOptions}</select>`;
    const routeValue = isSummaryRow ? `${getSelectedStartPointLabel()} → ${getMainHaulBaseDestination(dham)}` : '';
    const routePlaceholder = isSegmentRow
        ? `Segment ${segmentNumber}: ${segmentNumber === 1 ? getSelectedStartPointLabel() : 'Previous point'} → ${segmentNumber === segmentTotal ? getMainHaulBaseDestination(dham) : 'Next point'}`
        : 'e.g., Haridwar → Rishikesh';
    const routeCell = isSummaryRow
        ? `<span class="primary-route-label">${escapeHTML(routeValue)}</span><input type="hidden" name="primaryRoute_${fieldSuffix}" value="${escapeAttribute(routeValue)}">`
        : `<input type="text" name="primaryRoute_${fieldSuffix}" placeholder="${escapeAttribute(routePlaceholder)}" required>`;
    const actionCell = hasFixedDham && !isSegmentRow
        ? ''
        : `<button type="button" class="delete-btn" onclick="deletePrimaryModeRow('${rowId}')">Remove</button>`;

    return `
            <tr id="${rowId}" data-row-type="${rowType}" data-dham="${escapeAttribute(dham)}" data-segment-number="${escapeAttribute(segmentNumber)}">
            <td>${dhamCell}</td>
            <td>${routeCell}</td>
            <td><select name="primaryMode_${fieldSuffix}" required>${modeOptions}</select></td>
            <td><input type="number" name="primaryTime_${fieldSuffix}" min="0" step="0.1" placeholder="e.g., 5.5" required></td>
            <td><input type="number" name="primaryCost_${fieldSuffix}" min="0" placeholder="e.g., 1500" required></td>
            <td class="occupancy-cell"><input type="number" name="primaryOccupancy_${fieldSuffix}" min="1" placeholder="e.g., bus 35, taxi 4" required></td>
            <td>${actionCell}</td>
        </tr>`;
}
function addPrimaryModeRow() {
    const newRowHTML = createPrimaryModeRowHTML(primaryModeRowIndex, '', 'manual');
    primaryModeTableBody.insertAdjacentHTML('beforeend', newRowHTML);
    lockEnglishOptionValues(primaryModeTableBody.lastElementChild);
    primaryModeRowIndex++;
}
function deletePrimaryModeRow(rowId) {
    document.getElementById(rowId).remove();
}

function getMainHaulTransferOptionsHTML(selectedValue = '') {
    const options = [
        { value: '', label: '--Select--' },
        { value: '0', label: '0 transfers' },
        { value: '1', label: '1 transfer' },
        { value: '2', label: '2 transfers' },
        { value: '3', label: '3 or more transfers' },
        { value: 'Not sure / cannot recall', label: 'Not sure / cannot recall' }
    ];

    return options.map(option => {
        const selected = String(selectedValue) === option.value ? ' selected' : '';
        return `<option value="${escapeAttribute(option.value)}"${selected}>${escapeHTML(option.label)}</option>`;
    }).join('');
}

function updateMainHaulTransferSelectors() {
    const container = document.getElementById('mainHaulTransferSelection');
    if (!container) return;

    const previousValues = {};
    container.querySelectorAll('select[name^="mainHaulTransferCount_"]').forEach(select => {
        previousValues[select.name] = select.value;
    });

    const visitedDhams = getVisitedDhams();
    const rowsHTML = visitedDhams.map(dham => {
        const dhamSlug = getDhamSlug(dham);
        const fieldName = `mainHaulTransferCount_${dhamSlug}`;
        const selectedValue = previousValues[fieldName] || '';

        return `
            <label>
              ${escapeHTML(dham)}:
              <span class="field-helper">How many times did you change vehicle or mode before reaching ${escapeHTML(getMainHaulBaseDestination(dham))}?</span>
              <select name="${fieldName}" id="${fieldName}" data-dham="${escapeAttribute(dham)}" required>
                ${getMainHaulTransferOptionsHTML(selectedValue)}
              </select>
            </label>`;
    }).join('');

    container.innerHTML = `
        <h4>Transfers before reaching base/Dham</h4>
        ${visitedDhams.length
            ? rowsHTML
            : '<p class="field-helper">Select Dhams in A2 to show separate transfer fields for each route.</p>'}
    `;

    lockEnglishOptionValues(container);
}

function updatePrimaryModeTable() {
    updateMainHaulTransferSelectors();
    const visitedDhams = getVisitedDhams();

    primaryModeTableBody.querySelectorAll('tr[data-row-type="dham"], tr[data-row-type="segment"]').forEach(row => {
        const dhamName = row.dataset.dham;
        const segmentCount = getMainHaulSegmentRowCount(dhamName);
        const segmentNumber = Number(row.dataset.segmentNumber || 0);
        const shouldExist = visitedDhams.includes(dhamName);
        const shouldBeSegment = row.dataset.rowType === 'segment' && segmentCount > 1 && segmentNumber <= segmentCount;
        const shouldBeSummary = row.dataset.rowType === 'dham' && segmentCount === 1;

        if (!shouldExist || (!shouldBeSegment && !shouldBeSummary)) {
            row.remove();
        }
    });

    visitedDhams.forEach(dham => {
        const dhamSlug = getDhamSlug(dham);
        const segmentCount = getMainHaulSegmentRowCount(dham);
        if (segmentCount === 1) {
            if (!document.getElementById(`primary-row-${dhamSlug}`)) {
                primaryModeTableBody.insertAdjacentHTML('beforeend', createPrimaryModeRowHTML(primaryModeRowIndex, dham, 'dham'));
                lockEnglishOptionValues(primaryModeTableBody.lastElementChild);
                primaryModeRowIndex++;
            }
        } else {
            for (let segmentNumber = 1; segmentNumber <= segmentCount; segmentNumber++) {
                if (!document.getElementById(`primary-row-${dhamSlug}-segment-${segmentNumber}`)) {
                    primaryModeTableBody.insertAdjacentHTML(
                        'beforeend',
                        createPrimaryModeRowHTML(primaryModeRowIndex, dham, 'segment', segmentNumber, segmentCount)
                    );
                    lockEnglishOptionValues(primaryModeTableBody.lastElementChild);
                    primaryModeRowIndex++;
                }
            }
        }
    });

    updatePrimaryModeRouteCells();
    updateMainHaulTransferHint();
}

function updatePrimaryModeRouteCells() {
    if (!primaryModeTableBody) return;

    primaryModeTableBody.querySelectorAll('tr[data-row-type="dham"]').forEach(row => {
        const dham = row.dataset.dham;
        const routeValue = `${getSelectedStartPointLabel()} → ${getMainHaulBaseDestination(dham)}`;
        const routeLabel = row.querySelector('.primary-route-label');
        const routeInput = row.querySelector('input[name^="primaryRoute_"]');

        if (routeLabel) routeLabel.textContent = routeValue;
        if (routeInput) routeInput.value = routeValue;
    });
}

function getMainHaulSegmentRowCount(dham = '') {
    const dhamSlug = getDhamSlug(dham);
    const value = document.getElementById(`mainHaulTransferCount_${dhamSlug}`)?.value || '';
    const transferCount = Number(value);
    if (Number.isFinite(transferCount) && transferCount > 0) {
        return transferCount + 1;
    }
    return 1;
}

function updateMainHaulTransferHint() {
    const hint = document.getElementById('mainHaulTransferHint');
    if (!hint) return;

    const visitedDhams = getVisitedDhams();
    const segmentedDhams = visitedDhams
        .map(dham => ({ dham, segmentCount: getMainHaulSegmentRowCount(dham) }))
        .filter(item => item.segmentCount > 1);

    if (segmentedDhams.length > 0) {
        hint.textContent = segmentedDhams
            .map(item => `${item.dham}: ${item.segmentCount} route rows`)
            .join('; ') + '. Enter each segment and mode.';
    } else if (visitedDhams.some(dham => document.getElementById(`mainHaulTransferCount_${getDhamSlug(dham)}`)?.value === 'Not sure / cannot recall')) {
        hint.textContent = 'One broad route row will show for routes marked not sure.';
    } else {
        hint.textContent = '';
    }
}

const ALL_STOPOVER_LOCATIONS = [
    'Haridwar',
    'Rishikesh',
    'Devprayag',
    'Srinagar Garhwal',
    'Rudraprayag',
    'Guptkashi',
    'Phata',
    'Sonprayag',
    'Gaurikund',
    'Karnaprayag',
    'Joshimath',
    'Pipalkoti',
    'Chamoli',
    'Badrinath',
    'Govindghat',
    'Ghangaria',
    'Uttarkashi',
    'Harsil',
    'Gangotri',
    'Barkot',
    'Janki Chatti',
    'Yamunotri',
    'Other'
];

const STOPOVER_LOCATIONS_BY_DHAM = {
    Kedarnath: ['Haridwar', 'Rishikesh', 'Devprayag', 'Srinagar Garhwal', 'Rudraprayag', 'Guptkashi', 'Phata', 'Sonprayag', 'Gaurikund', 'Other'],
    Badrinath: ['Haridwar', 'Rishikesh', 'Devprayag', 'Srinagar Garhwal', 'Rudraprayag', 'Karnaprayag', 'Chamoli', 'Pipalkoti', 'Joshimath', 'Badrinath', 'Other'],
    Gangotri: ['Haridwar', 'Rishikesh', 'Uttarkashi', 'Harsil', 'Gangotri', 'Other'],
    Yamunotri: ['Haridwar', 'Rishikesh', 'Barkot', 'Janki Chatti', 'Yamunotri', 'Other'],
    'Hemkund Sahib': ['Haridwar', 'Rishikesh', 'Devprayag', 'Srinagar Garhwal', 'Rudraprayag', 'Karnaprayag', 'Chamoli', 'Pipalkoti', 'Joshimath', 'Govindghat', 'Ghangaria', 'Other']
};

function buildStopoverLocationOptions(dham = '') {
    const locations = STOPOVER_LOCATIONS_BY_DHAM[dham] || ALL_STOPOVER_LOCATIONS;
    const locationOptions = locations
        .map(location => `<option>${escapeHTML(location)}</option>`)
        .join('');
    return `<option value="">--Select location--</option>${locationOptions}`;
}

function createRestLocationRowHTML(index, dham = '') {
    const isAutoDhamRow = Boolean(dham);
    const dhamSlug = getDhamSlug(dham);
    const rowId = isAutoDhamRow ? `rest-row-${dhamSlug}` : `rest-row-extra-${index}`;
    const purposeOptions = `<option value="">--Select--</option><option>Food/Refreshment</option><option>Rest/Toilet Break</option><option>Night Halt/Accommodation</option><option>Sightseeing</option><option>Medical/First Aid</option><option>Parking/Vehicle Change</option><option>Other</option>`;
    const locationOptions = buildStopoverLocationOptions(dham);
    const accomOptions = `<option value="N/A">N/A (Short Stop)</option><option>Roadside Food/Tea Stall</option><option>Restaurant/Dhaba</option><option>Public Rest/Toilet Facility</option><option>Hotel</option><option>Dharamshala</option><option>Guest House</option><option>Ashram</option><option>Parking/Transport Hub</option><option>Other</option>`;
    const requiredAttr = isAutoDhamRow ? '' : ' required';
    const routeCell = isAutoDhamRow
        ? `Route to ${escapeHTML(dham)}<input type="hidden" name="restRoute_${index}" value="Route to ${escapeAttribute(dham)}">`
        : `<input type="text" name="restRoute_${index}" placeholder="e.g., Haridwar-Kedarnath" required>`;
    const actionCell = isAutoDhamRow
        ? ''
        : `<button type="button" class="delete-btn" onclick="deleteRestLocationRow('${rowId}')">Delete</button>`;
    return `
        <tr id="${rowId}">
            <td>${routeCell}</td>
            <td><select name="restLocation_${index}"${requiredAttr}>${locationOptions}</select></td>
            <td><select name="restPurpose_${index}"${requiredAttr}>${purposeOptions}</select></td>
            <td><input type="number" name="restDuration_${index}" min="0" step="0.1" placeholder="e.g., 8"${requiredAttr}></td>
            <td><select name="restAccom_${index}"${requiredAttr}>${accomOptions}</select></td>
            <td><input type="number" name="restCost_${index}" min="0" placeholder="e.g., 300"${requiredAttr}></td>
            <td>${actionCell}</td>
        </tr>`;
}
function addRestLocationRow() {
    const newRowHTML = createRestLocationRowHTML(restLocationRowIndex);
    restLocationTableBody.insertAdjacentHTML('beforeend', newRowHTML);
    lockEnglishOptionValues(restLocationTableBody.lastElementChild);
    initializeOtherSpecifyFields(restLocationTableBody.lastElementChild);
    restLocationRowIndex++;
}
function deleteRestLocationRow(rowId) {
    document.getElementById(rowId).remove();
}

function updateRestLocationTable() {
    const visitedDhams = getVisitedDhams();
    const existingAutoRows = new Set(
        Array.from(restLocationTableBody.querySelectorAll('tr[id^="rest-row-"]:not([id^="rest-row-extra-"])'))
            .map(row => row.id.replace('rest-row-', ''))
    );

    visitedDhams.forEach(dham => {
        const dhamSlug = getDhamSlug(dham);
        if (!existingAutoRows.has(dhamSlug)) {
            restLocationTableBody.insertAdjacentHTML('beforeend', createRestLocationRowHTML(restLocationRowIndex, dham));
            lockEnglishOptionValues(restLocationTableBody.lastElementChild);
            initializeOtherSpecifyFields(restLocationTableBody.lastElementChild);
            restLocationRowIndex++;
        }
    });

    existingAutoRows.forEach(dhamSlug => {
        const dhamName = Array.from(dhamCheckboxes).find(cb => getDhamSlug(cb.dataset.dham) === dhamSlug)?.dataset.dham;
        if (dhamName && !visitedDhams.includes(dhamName)) {
            document.getElementById(`rest-row-${dhamSlug}`)?.remove();
        }
    });
}

function createLastMileRowHTML(dham) {
    const dhamSlug = dham.replace(/\s/g, '');
    const modeOptions = `<option value="">--Select--</option><option>Trek/Walk</option><option>Pony/Mule</option><option>Palki/Dandi</option><option>Helicopter</option><option>Local Vehicle/Taxi</option><option>Other</option>`;
    const routeValue = getLastMileRouteSegment(dham);

    return `
        <tr id="last-mile-row-${dhamSlug}">
            <td>${dham}</td>
            <td><span class="last-mile-route-label">${escapeHTML(routeValue)}</span><input type="hidden" name="lastMileRoute_${dhamSlug}" value="${escapeAttribute(routeValue)}"></td>
            <td><select name="lastMileMode_${dhamSlug}" required>${modeOptions}</select></td>
            <td><input type="number" name="lastMileTime_${dhamSlug}" min="0" step="0.1" placeholder="e.g., 6" required></td>
            <td><input type="number" name="lastMileCost_${dhamSlug}" min="0" placeholder="e.g., 2500" required></td>
            <td><button type="button" class="delete-btn" onclick="deleteLastMileRow('${dhamSlug}')">Remove</button></td>
        </tr>`;
}

function getLastMileRouteSegment(dham) {
    const routesByDham = {
        Kedarnath: 'Sonprayag/Gaurikund → Kedarnath Temple',
        Badrinath: 'Badrinath road-head → Badrinath Temple',
        Gangotri: 'Gangotri road-head → Gangotri Temple',
        Yamunotri: 'Janki Chatti/Kharsali → Yamunotri Temple',
        'Hemkund Sahib': 'Govindghat/Ghangaria → Hemkund Sahib'
    };
    return routesByDham[dham] || `${dham} route → Temple`;
}
function deleteLastMileRow(dhamSlug) {
    const row = document.getElementById(`last-mile-row-${dhamSlug}`);
    if (row) row.remove();
    
    const checkbox = Array.from(dhamCheckboxes).find(cb => cb.dataset.dham.replace(/\s/g, '') === dhamSlug);
    if(checkbox) checkbox.checked = false;
    
    deleteStayDurationRow(dhamSlug);
    updatePrimaryModeTable();
    updateRestLocationTable();
    updateDhamSequenceDropdowns();
    initializeDCE(); // Re-run DCE logic
}

function handleLastMileModeChange(select) {
    const row = select.closest('tr');
    const costInput = row?.querySelector('input[name^="lastMileCost_"]');
    if (!costInput) return;

    if (select.value === 'Trek/Walk') {
        costInput.value = 0;
        costInput.readOnly = true;
    } else {
        costInput.readOnly = false;
        if (costInput.value === '0') {
            costInput.value = '';
        }
    }
}

function createStayDurationRowHTML(dham) {
    const dhamSlug = dham.replace(/\s/g, '');
    const accomOptions = `<option value="">--Select--</option><option>Hotel</option><option>Dharamshala</option><option>Guest House</option><option>Ashram</option><option>Tent</option><option>Other</option>`;
    return `
        <tr id="stay-duration-row-${dhamSlug}">
            <td>${dham}</td>
            <td><input type="radio" name="stayDuration_${dhamSlug}" value="8-12h" required></td>
            <td><input type="radio" name="stayDuration_${dhamSlug}" value="12-18h"></td>
            <td><input type="radio" name="stayDuration_${dhamSlug}" value="18-24h"></td>
            <td><input type="radio" name="stayDuration_${dhamSlug}" value=">24h"></td>
            <td><select name="stayAccom_${dhamSlug}" required>${accomOptions}</select></td>
            <td><input type="number" name="stayAccomCost_${dhamSlug}" min="0" placeholder="e.g., 1500" required></td>
        </tr>`;
}
function deleteStayDurationRow(dhamSlug) {
    const row = document.getElementById(`stay-duration-row-${dhamSlug}`);
    if (row) row.remove();
}

function updateLastMileTable() {
    const visitedDhams = getVisitedDhams();
    const existingRows = new Set(Array.from(lastMileTableBody.querySelectorAll('tr')).map(tr => tr.id.replace('last-mile-row-', '')));

    visitedDhams.forEach(dham => {
        const dhamSlug = dham.replace(/\s/g, '');
        if (!existingRows.has(dhamSlug)) {
            lastMileTableBody.insertAdjacentHTML('beforeend', createLastMileRowHTML(dham));
            stayDurationTableBody.insertAdjacentHTML('beforeend', createStayDurationRowHTML(dham));
            lockEnglishOptionValues(lastMileTableBody.querySelector(`#last-mile-row-${dhamSlug}`));
            lockEnglishOptionValues(stayDurationTableBody.querySelector(`#stay-duration-row-${dhamSlug}`));
            initializeOtherSpecifyFields(lastMileTableBody.querySelector(`#last-mile-row-${dhamSlug}`));
            initializeOtherSpecifyFields(stayDurationTableBody.querySelector(`#stay-duration-row-${dhamSlug}`));
        }
    });

    existingRows.forEach(dhamSlug => {
        // Find the original Dham name (with spaces) to check against visitedDhams
        const dhamName = Array.from(dhamCheckboxes).find(cb => cb.dataset.dham.replace(/\s/g, '') === dhamSlug)?.dataset.dham;
        
        if (dhamName && !visitedDhams.includes(dhamName)) {
            deleteLastMileRow(dhamSlug);
        }
    });
}

function updateDhamSequenceDropdowns() {
    const visitedDhams = getVisitedDhams();
    const container = document.getElementById('dhamSequenceSelection');
    const previousSelections = Array.from(container.querySelectorAll('select[name^="dhamSequence_"]'))
        .map(select => select.value)
        .filter(value => visitedDhams.includes(value));
    
    if (visitedDhams.length === 0) {
        container.innerHTML = '<h4>Order of Dham Visits</h4><p style="color: grey;">Select Dhams in A2 to show visit-order fields.</p>';
        return;
    }

    if (visitedDhams.length === 1) {
        container.innerHTML = `<h4>Order of Dham Visits</h4><p style="color: grey;">Only ${escapeHTML(visitedDhams[0])} selected. No order needed.</p>`;
        return;
    }
    
    let html = '<h4>Order of Dham Visits</h4><p style="color: grey;">Select visit order.</p>';

    for (let i = 0; i < visitedDhams.length; i++) {
        const selectedDham = previousSelections[i] || '';
        html += `
            <label>Visit ${i + 1}:
                <select name="dhamSequence_${i + 1}" data-selected-dham="${escapeAttribute(selectedDham)}" required>
                </select>
            </label>`;
    }
    container.innerHTML = html;
    container.querySelectorAll('select[name^="dhamSequence_"]').forEach(select => {
        select.value = select.dataset.selectedDham || '';
    });
    refreshDhamSequenceOptions();
}

function refreshDhamSequenceOptions() {
    const visitedDhams = getVisitedDhams();
    const selects = Array.from(document.querySelectorAll('select[name^="dhamSequence_"]'));
    const selectedValues = selects.map(select => select.value || select.dataset.selectedDham || '').filter(Boolean);

    selects.forEach(select => {
        const currentValue = select.value || select.dataset.selectedDham || '';
        const unavailableValues = new Set(selectedValues.filter(value => value !== currentValue));
        let options = '<option value="">--Select Dham--</option>';

        visitedDhams.forEach(dham => {
            if (!unavailableValues.has(dham)) {
                const selected = dham === currentValue ? ' selected' : '';
                options += `<option value="${escapeAttribute(dham)}"${selected}>${escapeHTML(dham)}</option>`;
            }
        });

        select.innerHTML = options;
        select.dataset.selectedDham = currentValue;
    });
    lockEnglishOptionValues(document.getElementById('dhamSequenceSelection'));
}

function handleTravelTypeChange() {
    const travelType = document.getElementById('travelType').value;
    const groupSizeInput = document.getElementById('groupSize');
    const groupSizeLabel = document.getElementById('groupSizeLabel');
    const groupSizeHelper = document.getElementById('groupSizeHelper');
    const groupCompositionFields = document.getElementById('groupCompositionFields');
    const assistanceQuestionText = document.getElementById('specialAssistanceRequirementText');
    const assistanceSelect = document.querySelector('select[name="specialAssistanceRequirement"]');
    const anotherMemberOption = assistanceSelect
        ? Array.from(assistanceSelect.options).find(option => option.textContent.trim() === 'Yes - for another group member')
        : null;
    
    if (travelType === 'Solo') {
        groupSizeInput.value = 1;
        groupSizeInput.readOnly = true;
        if (groupSizeLabel) {
            groupSizeLabel.style.display = 'none';
        }
        if (groupSizeHelper) {
            groupSizeHelper.style.display = 'none';
        }
        if (assistanceQuestionText) {
            assistanceQuestionText.textContent = 'Need mobility assistance?';
        }
        if (anotherMemberOption) {
            anotherMemberOption.hidden = true;
            anotherMemberOption.disabled = true;
            if (assistanceSelect.value === anotherMemberOption.value) {
                assistanceSelect.value = '';
            }
        }
        if (groupCompositionFields) {
            groupCompositionFields.style.display = 'none';
            groupCompositionFields.querySelectorAll('input').forEach(input => {
                input.value = '';
                input.style.border = '';
            });
        }
    } else {
        groupSizeInput.readOnly = false;
        if (groupSizeLabel) {
            groupSizeLabel.style.display = '';
        }
        if (groupSizeHelper) {
            groupSizeHelper.style.display = '';
        }
        if (assistanceQuestionText) {
            assistanceQuestionText.textContent = 'Anyone in your group need mobility assistance?';
        }
        if (anotherMemberOption) {
            anotherMemberOption.hidden = false;
            anotherMemberOption.disabled = false;
        }
        if (groupSizeInput.value === '1') {
             groupSizeInput.value = 2; 
        }
        if (groupCompositionFields) {
            groupCompositionFields.style.display = 'block';
        }
    }
    
    validateGroupComposition();
}

function getGroupCompositionInputs() {
    return Array.from(document.querySelectorAll('#groupCompositionFields input[type="number"]'));
}

function validateGroupComposition() {
    const travelType = document.getElementById('travelType')?.value;
    const groupSizeInput = document.getElementById('groupSize');
    const groupCompositionFields = document.getElementById('groupCompositionFields');
    const message = document.getElementById('groupCompositionMessage');

    if (!groupSizeInput || !groupCompositionFields || !message || travelType !== 'Group') {
        return true;
    }

    const groupSize = Number(groupSizeInput.value) || 0;
    const inputs = getGroupCompositionInputs();
    const compositionTotal = inputs.reduce((sum, input) => sum + (Number(input.value) || 0), 0);
    const hasCompositionInput = inputs.some(input => input.value !== '');
    const isValid = !hasCompositionInput || compositionTotal <= groupSize;

    inputs.forEach(input => {
        input.style.border = isValid ? '' : '2px solid red';
    });

    if (!hasCompositionInput) {
        message.textContent = '';
        message.classList.remove('field-helper-error');
    } else if (isValid) {
        message.textContent = `Composition total: ${compositionTotal} of ${groupSize} travelers.`;
        message.classList.remove('field-helper-error');
    } else {
        message.textContent = `Composition total is ${compositionTotal}, which exceeds the group size of ${groupSize}.`;
        message.classList.add('field-helper-error');
    }

    return isValid;
}

function updateRepeatVisitReasonVisibility() {
    const repeatVisitReasonLabel = document.getElementById('repeatVisitReasonLabel');
    const repeatVisitReason = document.getElementById('repeatVisitReason');
    if (!repeatVisitReasonLabel || !repeatVisitReason) return;

    const visitHistoryNames = ['kedarnath', 'badrinath', 'gangotri', 'yamunotri', 'hemkund'];
    const hasPreviousVisit = visitHistoryNames.some(name => {
        const selected = document.querySelector(`input[name="${name}"]:checked`);
        return selected && selected.value !== '0';
    });

    repeatVisitReasonLabel.style.display = hasPreviousVisit ? 'block' : 'none';
    repeatVisitReason.required = hasPreviousVisit;

    if (!hasPreviousVisit) {
        repeatVisitReason.value = '';
        repeatVisitReason.style.border = '';
    }
}

function handleStartPointChange() {
    const startPoint = document.getElementById('startPoint');
    const otherStartPointLabel = document.getElementById('otherStartPointLabel');
    const otherStartPointInput = document.getElementById('otherStartPoint');
    const isOther = startPoint && startPoint.value === 'Other';

    if (!otherStartPointLabel || !otherStartPointInput) return;

    otherStartPointLabel.style.display = isOther ? 'block' : 'none';
    otherStartPointInput.required = isOther;
    if (!isOther) {
        otherStartPointInput.value = '';
        otherStartPointInput.style.border = '';
    }
    updateMainHaulHeadings();
    updatePrimaryModeRouteCells();
}

function getSelectedStartPointLabel() {
    const startPoint = document.getElementById('startPoint');
    const otherStartPointInput = document.getElementById('otherStartPoint');

    if (!startPoint || !startPoint.value) return 'Starting Point';
    if (startPoint.value === 'Other') {
        return otherStartPointInput?.value.trim() || 'Other Starting Point';
    }
    return startPoint.value;
}

function updateMainHaulHeadings() {
    const startPointLabel = getSelectedStartPointLabel();
    const mainHaulSectionHeading = document.querySelector('#page-3-C .section-card > h3');
    const destinationsByDham = {
        Kedarnath: 'Sonprayag',
        Badrinath: 'Badrinath',
        Yamunotri: 'Janki Chatti',
        Gangotri: 'Gangotri',
        HemkundSahib: 'Govindghat'
    };

    if (mainHaulSectionHeading) {
        mainHaulSectionHeading.textContent = `Section B1: Main-Haul Choice (${startPointLabel} → Base Camp / Dham Destination)`;
    }

    Object.entries(destinationsByDham).forEach(([dhamSlug, destination]) => {
        const heading = document.querySelector(`#main-haul-${dhamSlug}-block h4`);
        if (!heading) return;

        const dhamName = dhamSlug === 'HemkundSahib' ? 'Hemkund Sahib' : dhamSlug;
        heading.textContent = `${dhamName}: ${startPointLabel} → ${destination}`;
    });
    updatePrimaryModeRouteCells();
}

function sanitizeFieldId(value) {
    return String(value || 'field').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function controlHasOtherOption(control) {
    if (control.tagName === 'SELECT') {
        return Array.from(control.options).some(option => option.value === 'Other' || option.textContent.trim() === 'Other');
    }

    return control.type === 'checkbox' && control.value === 'Other';
}

function getOtherSpecifyElements(control) {
    const configuredLabelId = control.dataset.otherLabelId;
    const configuredInputId = control.dataset.otherInputId;

    if (configuredLabelId && configuredInputId) {
        return {
            label: document.getElementById(configuredLabelId),
            input: document.getElementById(configuredInputId)
        };
    }

    const fieldId = `otherSpecify_${sanitizeFieldId(control.name || control.id)}`;
    let label = document.getElementById(`${fieldId}Label`);
    let input = document.getElementById(fieldId);

    if (!label || !input) {
        label = document.createElement('label');
        label.id = `${fieldId}Label`;
        label.className = 'other-specify-label';
        label.style.display = 'none';
        label.innerHTML = `Please specify:
          <input type="text" name="${sanitizeFieldId(control.name || control.id)}_otherSpecify" id="${fieldId}" placeholder="Please specify">
        `;
        input = label.querySelector('input');

        const anchor = control.closest('label') || control;
        anchor.insertAdjacentElement('afterend', label);
    }

    return { label, input };
}

function updateOtherSpecifyField(control) {
    if (!controlHasOtherOption(control)) return;

    const { label, input } = getOtherSpecifyElements(control);
    if (!label || !input) return;

    const isOtherSelected = control.tagName === 'SELECT'
        ? control.value === 'Other'
        : control.checked;

    label.style.display = isOtherSelected ? 'block' : 'none';
    input.required = isOtherSelected;

    if (!isOtherSelected) {
        input.value = '';
        input.style.border = '';
    }
}

function initializeOtherSpecifyFields(scope = document) {
    scope.querySelectorAll('select, input[type="checkbox"]').forEach(control => {
        if (controlHasOtherOption(control)) {
            updateOtherSpecifyField(control);
        }
    });
}

function lockEnglishOptionValues(scope = document) {
    scope.querySelectorAll('select option').forEach(option => {
        const hasExplicitValue = option.hasAttribute('value');
        const displayText = option.textContent.trim();

        if (!displayText || option.disabled) return;

        if (!option.dataset.englishValue) {
            option.dataset.englishValue = hasExplicitValue && option.value !== '' ? option.value : displayText;
        }

        if (!hasExplicitValue || option.value !== '') {
            option.value = option.dataset.englishValue;
        }
    });
}

function resetDynamicSurveyState() {
    primaryModeRowIndex = 0;
    restLocationRowIndex = 0;

    if (primaryModeTableBody) primaryModeTableBody.innerHTML = '';
    if (lastMileTableBody) lastMileTableBody.innerHTML = '';
    if (stayDurationTableBody) stayDurationTableBody.innerHTML = '';
    if (restLocationTableBody) restLocationTableBody.innerHTML = '';

    const sequenceContainer = document.getElementById('dhamSequenceSelection');
    if (sequenceContainer) {
        sequenceContainer.innerHTML = '<h4>Order of Dham Visits</h4><p style="color: grey;">Select Dhams in A2 to show visit-order fields.</p>';
    }

    document.querySelectorAll('[id^="main-haul-"][id$="-tasks"], [id^="last-mile-"][id$="-tasks"]').forEach(container => {
        container.innerHTML = '';
    });
    document.querySelectorAll('[id^="main-haul-"][id$="-block"], [id^="last-mile-"][id$="-block"]').forEach(block => {
        block.style.display = 'none';
    });

    if (primaryModeTableBody) updatePrimaryModeTable();
    if (restLocationTableBody) updateRestLocationTable();
    updateRepeatVisitReasonVisibility();
}

function clearValidationStyles() {
    form.querySelectorAll('input, select, textarea, table, div.dham-block').forEach(el => {
        el.style.border = '';
    });
}

function startNewResponse() {
    form.reset();
    resetDynamicSurveyState();
    clearValidationStyles();

    sessionStorage.removeItem('charDhamChoiceBlock');
    sessionStorage.removeItem('charDhamChoiceTaskNumbers');
    sessionStorage.removeItem('charDhamChoiceTaskMap');
    selectedChoiceTaskNumbersBySet = {};
    assignChoiceBlock();
    initializeSurveyTiming();

    currentTab = 0;
    showTab(currentTab);
    handleTravelTypeChange();
    renderTable();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function enhanceRatingTables() {
    document.querySelectorAll('.satisfaction-table, .likert-scale').forEach((table, tableIndex) => {
        if (table.style.display === 'none') return;
        if (table.dataset.quickRatingReady === 'true') return;
        table.dataset.quickRatingReady = 'true';

        const quickFill = document.createElement('div');
        quickFill.className = 'quick-rating-controls';
        quickFill.innerHTML = `
            <span>Quick fill:</span>
            <button type="button" data-rating="1">1</button>
            <button type="button" data-rating="2">2</button>
            <button type="button" data-rating="3">3</button>
            <button type="button" data-rating="4">4</button>
            <button type="button" data-rating="5">5</button>
            <button type="button" data-rating-clear="true">Clear</button>
        `;
        table.parentNode.insertBefore(quickFill, table);

        quickFill.addEventListener('click', event => {
            const button = event.target.closest('button');
            if (!button) return;

            const radioGroups = new Set(Array.from(table.querySelectorAll('input[type="radio"]')).map(radio => radio.name));
            if (button.dataset.ratingClear === 'true') {
                table.querySelectorAll('input[type="radio"]').forEach(radio => {
                    radio.checked = false;
                });
                return;
            }

            const rating = button.dataset.rating;
            radioGroups.forEach(name => {
                const radio = table.querySelector(`input[type="radio"][name="${name}"][value="${rating}"]`);
                if (radio) radio.checked = true;
            });
        });

        table.addEventListener('click', event => {
            const cell = event.target.closest('td');
            if (!cell) return;
            const radio = cell.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
        });
    });
}

// --- Data Handling & Submission ---
function toIndiaTimestamp(date = new Date()) {
    const indiaOffsetMinutes = 330;
    const indiaTime = new Date(date.getTime() + indiaOffsetMinutes * 60 * 1000);
    const localIsoWithoutZone = indiaTime.toISOString().replace('Z', '');
    return `${localIsoWithoutZone}+05:30`;
}

function initializeSurveyTiming() {
    const now = new Date();
    if (surveyStartTimestampInput) {
        surveyStartTimestampInput.value = toIndiaTimestamp(now);
    }
    if (surveySubmitTimestampInput) {
        surveySubmitTimestampInput.value = '';
    }
    if (surveyCompletionSecondsInput) {
        surveyCompletionSecondsInput.value = '';
    }
}

function updateSurveyTimingForSubmit() {
    const submitTime = new Date();
    if (!surveyStartTimestampInput?.value) {
        initializeSurveyTiming();
    }

    if (surveySubmitTimestampInput) {
        surveySubmitTimestampInput.value = toIndiaTimestamp(submitTime);
    }

    if (surveyCompletionSecondsInput && surveyStartTimestampInput?.value) {
        const startTime = new Date(surveyStartTimestampInput.value);
        const elapsedSeconds = Math.max(0, Math.round((submitTime.getTime() - startTime.getTime()) / 1000));
        surveyCompletionSecondsInput.value = String(elapsedSeconds);
    }
}

function handleFormSubmit() {
    updateChoiceBlockInput();
    updateSurveyTimingForSubmit();
    lockEnglishOptionValues(form);

    const formData = new FormData(form);
    const data = {};
    
    for (const [key, value] of formData.entries()) {
      if (data.hasOwnProperty(key)) {
        if (Array.isArray(data[key])) {
          data[key].push(value);
        } else {
          data[key] = [data[key], value];
        }
      } else {
        data[key] = value;
      }
    }
    
    const existingData = localStorage.getItem("charDhamSurvey");
    responses = existingData ? JSON.parse(existingData) : [];
    responses.push(data);
    localStorage.setItem("charDhamSurvey", JSON.stringify(responses));
    console.log('Data saved to localStorage (Backup)');

    // Submit to Google Script via hidden iframe
    // *** THIS IS THE UPDATED LINE WITH YOUR URL ***
    const scriptUrl = "https://script.google.com/macros/s/AKfycbwqaGDAzUAWRKFAMtD0eA76RDmQGCTnlrOT_LVIc2snRAyESDkjEgR1Kc1oXdPupTiNxQ/exec";
    form.action = scriptUrl;
    form.target = "googleSheetTarget"; 
    form.method = "POST";
    form.submit();
    console.log('Data submitted to Google Apps Script.');

    // Reset form attributes
    form.removeAttribute("action");
    form.removeAttribute("target");
    form.removeAttribute("method");

    renderTable(); 
}

// --- Local Storage Table & Export Functions ---
function renderTable() {
    if (!tableBody) return;
    tableBody.innerHTML = "";
    responses = JSON.parse(localStorage.getItem("charDhamSurvey")) || [];
    responses.forEach((res, index) => {
        const row = tableBody.insertRow();
        row.insertCell(0).innerHTML = `<input type="checkbox" class="local-response-checkbox" data-index="${index}" aria-label="Select response ${index + 1}">`;
        row.insertCell(1).textContent = res.age || 'N/A';
        row.insertCell(2).textContent = res.gender || 'N/A';
        row.insertCell(3).textContent = res.originCityDistrict || 'N/A';
        row.insertCell(4).textContent = res.occupation || 'N/A';
        row.insertCell(5).textContent = res.income || 'N/A';
        row.insertCell(6).textContent = res.education || 'N/A';
        row.insertCell(7).innerHTML = `<button class="delete-btn" onclick="deleteResponse(${index})">Delete</button>`;
    });
}

function deleteResponse(index) {
    if (confirm("Are you sure you want to delete this response?")) {
        responses.splice(index, 1);
        localStorage.setItem("charDhamSurvey", JSON.stringify(responses));
        renderTable();
    }
}

function selectAllLocalResponses() {
    const checkboxes = document.querySelectorAll('.local-response-checkbox');
    const shouldSelect = Array.from(checkboxes).some(checkbox => !checkbox.checked);
    checkboxes.forEach(checkbox => {
        checkbox.checked = shouldSelect;
    });
}

function deleteSelectedLocalResponses() {
    const selectedIndexes = Array.from(document.querySelectorAll('.local-response-checkbox:checked'))
        .map(checkbox => Number(checkbox.dataset.index))
        .filter(Number.isInteger);

    if (selectedIndexes.length === 0) {
        alert("Please select at least one local response to delete.");
        return;
    }

    if (!confirm(`Delete ${selectedIndexes.length} selected local response(s)? This will not delete Google Sheet rows.`)) {
        return;
    }

    const selectedIndexSet = new Set(selectedIndexes);
    responses = (JSON.parse(localStorage.getItem("charDhamSurvey")) || [])
        .filter((_, index) => !selectedIndexSet.has(index));
    localStorage.setItem("charDhamSurvey", JSON.stringify(responses));
    renderTable();
}

function deleteAllLocalResponses() {
    const savedResponses = JSON.parse(localStorage.getItem("charDhamSurvey")) || [];
    if (savedResponses.length === 0) {
        alert("No local responses found to delete.");
        return;
    }

    if (!confirm(`Delete all ${savedResponses.length} local response(s)? This will not delete Google Sheet rows.`)) {
        return;
    }

    responses = [];
    localStorage.removeItem("charDhamSurvey");
    renderTable();
}

function exportToCSV() {
    try {
        const savedResponses = localStorage.getItem("charDhamSurvey");
        const responsesToExport = savedResponses ? JSON.parse(savedResponses) : [];

        if (responsesToExport.length === 0) {
            alert("No survey responses found to export.");
            return;
        }

        const allKeys = new Set();
        responsesToExport.forEach(r => Object.keys(r).forEach(key => allKeys.add(key)));
        const headers = Array.from(allKeys);
        let csv = headers.join(',') + '\n';

        responsesToExport.forEach(r => {
            const row = headers.map(header => {
                let cell = r[header];
                if (cell === undefined || cell === null) return '""';
                if (Array.isArray(cell)) cell = cell.join('; '); 
                const cellString = String(cell).replace(/"/g, '""');
                return `"${cellString}"`;
            });
            csv += row.join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "char_dham_survey_responses.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        console.error("CSV Export failed: ", e);
        alert("An error occurred during CSV export.");
    }
}

function exportToXLSX() {
    const savedResponses = localStorage.getItem("charDhamSurvey");
    const responsesToExport = savedResponses ? JSON.parse(savedResponses) : [];
    
    if (responsesToExport.length === 0) {
        alert("No survey responses found to export.");
        return;
    }
    if (typeof XLSX === 'undefined') {
        alert("Excel export library is not loaded. Please check your internet connection and the <script> tag in index.html.");
        return;
    }

    const workbook = XLSX.utils.book_new();
    appendRawOrderedSheet(workbook, responsesToExport);
    appendJsonSheet(workbook, "Respondents", buildLocalRespondents(responsesToExport));
    appendJsonSheet(workbook, "DhamVisits", buildLocalDhamVisits(responsesToExport));
    appendJsonSheet(workbook, "MainHaulSegments", buildLocalMainHaulSegments(responsesToExport));
    appendJsonSheet(workbook, "Stopovers", buildLocalStopovers(responsesToExport));
    appendJsonSheet(workbook, "LastMileTrips", buildLocalLastMileTrips(responsesToExport));
    appendJsonSheet(workbook, "ChoiceResponses", buildLocalChoiceResponses(responsesToExport));
    XLSX.writeFile(workbook, "char_dham_survey_responses.xlsx");
}

function localCellValue(value) {
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object' && value !== null) return JSON.stringify(value);
    return value ?? '';
}

function getLocalResponseId(response, index) {
    return response.responseId || response.localResponseId || `LOCAL_${String(index + 1).padStart(4, '0')}`;
}

function getLocalField(response, key) {
    return localCellValue(response[key]);
}

function getLocalSelectedDhams(response) {
    const value = response.dhamCurrentVisit;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        return value.split(',').map(item => item.trim()).filter(Boolean);
    }
    return [];
}

function localDhamSlug(dham) {
    return String(dham).replace(/\s/g, '');
}

function localPreviousVisitKey(dham) {
    return dham === 'Hemkund Sahib' ? 'hemkund' : String(dham).toLowerCase();
}

function appendJsonSheet(workbook, sheetName, rows) {
    const worksheet = rows.length > 0
        ? XLSX.utils.json_to_sheet(rows)
        : XLSX.utils.aoa_to_sheet([['No data']]);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
}

function appendRawOrderedSheet(workbook, responsesToExport) {
    const groups = getLocalRawColumnGroups(responsesToExport);
    const headers = [];
    const sections = [];

    groups.forEach(group => {
        group.fields.forEach(field => {
            if (!headers.includes(field)) {
                headers.push(field);
                sections.push(group.section);
            }
        });
    });

    const rows = [
        sections,
        headers,
        ...responsesToExport.map((response, index) => headers.map(header => {
            if (header === 'responseId') return getLocalResponseId(response, index);
            return getLocalField(response, header);
        }))
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!merges'] = buildSectionMerges(sections);
    XLSX.utils.book_append_sheet(workbook, worksheet, "RawOrdered");
}

function buildSectionMerges(sections) {
    const merges = [];
    let start = 0;

    for (let i = 1; i <= sections.length; i++) {
        if (sections[i] !== sections[start]) {
            if (i - start > 1) {
                merges.push({ s: { r: 0, c: start }, e: { r: 0, c: i - 1 } });
            }
            start = i;
        }
    }

    return merges;
}

function getLocalRawColumnGroups(responsesToExport) {
    const allKeys = Array.from(new Set(responsesToExport.flatMap(response => Object.keys(response))));
    const hasKey = key => allKeys.includes(key);
    const matching = regex => allKeys.filter(key => regex.test(key)).sort(naturalLocalSort);
    const dynamicIndexed = prefixes => {
        const suffixes = new Set();
        prefixes.forEach(prefix => {
            allKeys.forEach(key => {
                const match = key.match(new RegExp(`^${prefix}_(.+)$`));
                if (match) suffixes.add(match[1]);
            });
        });
        return Array.from(suffixes).sort(mainHaulLocalSuffixSort).flatMap(suffix =>
            prefixes.map(prefix => `${prefix}_${suffix}`).filter(hasKey)
        );
    };

    const groups = [
        { section: 'Submission', fields: ['responseId', 'surveyStartTimestamp', 'surveySubmitTimestamp', 'surveyCompletionSeconds', 'choiceBlock'] },
        { section: 'Respondent Profile', fields: ['age', 'gender', 'originStateUT', 'originCityDistrict', 'occupation', 'income', 'education'] },
        { section: 'Travel Group', fields: ['tripStatus', 'travelType', 'groupSize', 'groupAdults', 'groupChildren', 'groupElderly', 'groupAssistanceCount', 'mobilityStatus', 'specialAssistanceRequirement'] },
        { section: 'Planning And Budget', fields: ['transportInfoSource', 'transportBookingMethod', 'transportDecisionMaker', 'yatraRegistration', 'totalTripBudget'] },
        { section: 'Visit History And Itinerary', fields: ['kedarnath', 'badrinath', 'gangotri', 'yamunotri', 'hemkund', 'dhamCurrentVisit', 'repeatVisitReason', 'startPoint', 'otherStartPoint', 'totalDurationDays', ...matching(/^dhamSequence_\d+$/)] },
        { section: 'Main-Haul Transfers', fields: ['mainHaulTransferCount_Kedarnath', 'mainHaulTransferCount_Badrinath', 'mainHaulTransferCount_Gangotri', 'mainHaulTransferCount_Yamunotri', 'mainHaulTransferCount_HemkundSahib'] },
        { section: 'Main-Haul Travel Rows', fields: dynamicIndexed(['primaryDham', 'primaryRoute', 'primaryMode', 'primaryTime', 'primaryCost', 'primaryOccupancy']) },
        { section: 'Stopovers', fields: dynamicIndexed(['restRoute', 'restLocation', 'restPurpose', 'restDuration', 'restAccom', 'restCost']) },
        { section: 'Last-Mile Travel', fields: allKeys.filter(key => /^(lastMileRoute|lastMileMode|lastMileTime|lastMileCost)_/.test(key)).sort(naturalLocalSort) },
        { section: 'Stay And Accommodation', fields: allKeys.filter(key => /^(stayDuration|stayAccom|stayAccomCost)_/.test(key)).sort(naturalLocalSort) },
        { section: 'Service Evaluation', fields: allKeys.filter(key => /^(eval|lastMileEval)/.test(key)).sort(naturalLocalSort) },
        { section: 'Main-Haul Choice Experiment', fields: ['railwayAwareness', 'hillTrainExperience', ...matching(/^main_haul_[A-Za-z]+_Task\d+$/)] },
        { section: 'Last-Mile Choice Experiment', fields: ['ropewayAwareness', ...matching(/^last_mile_[A-Za-z]+_Task\d+$/)] },
        { section: 'Integrated Services', fields: ['integratedUse', 'integratedPayment', 'guaranteedSeatWtp', 'helicopterReducedCostIntent', 'integratedNoReason', 'integratedTime', 'integratedCost', 'integratedComfort', 'integratedReliability', 'integratedSafety'] },
        { section: 'Priorities And Attitudes', fields: allKeys.filter(key => /^(priority|attitude)|maxAcceptableWait/.test(key)).sort(naturalLocalSort) },
        { section: 'Feedback', fields: ['insuranceMedicalAwareness', 'challenge', 'feedbackChallenge', 'feedbackSuggestions', 'feedbackOther'] }
    ].map(group => ({ ...group, fields: group.fields.filter(field => field === 'responseId' || hasKey(field)) }));

    const known = new Set(groups.flatMap(group => group.fields));
    const otherSpecify = allKeys.filter(key => !known.has(key) && key.endsWith('_otherSpecify')).sort(naturalLocalSort);
    const other = allKeys.filter(key => !known.has(key) && !otherSpecify.includes(key)).sort(naturalLocalSort);
    if (otherSpecify.length) groups.push({ section: 'Other Specify', fields: otherSpecify });
    if (other.length) groups.push({ section: 'Other Raw Fields', fields: other });
    return groups;
}

function naturalLocalSort(a, b) {
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

function mainHaulLocalSuffixSort(a, b) {
    const parse = suffix => {
        const order = { Kedarnath: 1, Badrinath: 2, Gangotri: 3, Yamunotri: 4, HemkundSahib: 5 };
        const stable = String(suffix).match(/^([A-Za-z]+)_(route|segment(\d+))$/);
        if (stable) return [order[stable[1]] || 98, stable[2] === 'route' ? 0 : Number(stable[3])];
        const numeric = String(suffix).match(/^\d+$/);
        if (numeric) return [99, Number(suffix)];
        return [98, 999];
    };
    const pa = parse(a);
    const pb = parse(b);
    return pa[0] - pb[0] || pa[1] - pb[1] || naturalLocalSort(a, b);
}

function buildLocalRespondents(responsesToExport) {
    const headers = ['responseId', 'surveyStartTimestamp', 'surveySubmitTimestamp', 'surveyCompletionSeconds', 'age', 'gender', 'originStateUT', 'originCityDistrict', 'occupation', 'income', 'education', 'tripStatus', 'travelType', 'groupSize', 'groupAdults', 'groupChildren', 'groupElderly', 'groupAssistanceCount', 'transportInfoSource', 'transportBookingMethod', 'transportDecisionMaker', 'yatraRegistration', 'totalTripBudget', 'mobilityStatus', 'specialAssistanceRequirement', 'startPoint', 'otherStartPoint', 'totalDurationDays', 'dhamCurrentVisit', 'repeatVisitReason', 'railwayAwareness', 'hillTrainExperience', 'integratedUse', 'integratedPayment', 'guaranteedSeatWtp', 'helicopterReducedCostIntent', 'integratedNoReason', 'insuranceMedicalAwareness', 'challenge', 'feedbackChallenge', 'feedbackSuggestions', 'feedbackOther'];
    return responsesToExport.map((response, index) => Object.fromEntries(headers.map(header => [
        header,
        header === 'responseId' ? getLocalResponseId(response, index) : getLocalField(response, header)
    ])));
}

function buildLocalDhamVisits(responsesToExport) {
    return responsesToExport.flatMap((response, index) => {
        const responseId = getLocalResponseId(response, index);
        return getLocalSelectedDhams(response).map(dham => {
            const slug = localDhamSlug(dham);
            return {
                responseId,
                dham,
                previousVisits: getLocalField(response, localPreviousVisitKey(dham)),
                mainHaulTransfers: getLocalField(response, `mainHaulTransferCount_${slug}`),
                stayDuration: getLocalField(response, `stayDuration_${slug}`),
                stayAccommodation: getLocalField(response, `stayAccom_${slug}`),
                stayAccommodationCost: getLocalField(response, `stayAccomCost_${slug}`)
            };
        });
    });
}

function getLocalMainHaulSuffixes(response) {
    return Object.keys(response)
        .map(key => key.match(/^primaryDham_(.+)$/))
        .filter(Boolean)
        .map(match => match[1])
        .sort(mainHaulLocalSuffixSort);
}

function buildLocalMainHaulSegments(responsesToExport) {
    return responsesToExport.flatMap((response, index) => {
        const responseId = getLocalResponseId(response, index);
        return getLocalMainHaulSuffixes(response).map(suffix => ({
            responseId,
            segmentIndex: suffix,
            dham: getLocalField(response, `primaryDham_${suffix}`),
            route: getLocalField(response, `primaryRoute_${suffix}`),
            mode: getLocalField(response, `primaryMode_${suffix}`),
            timeHours: getLocalField(response, `primaryTime_${suffix}`),
            costPerPerson: getLocalField(response, `primaryCost_${suffix}`),
            vehicleOccupancy: getLocalField(response, `primaryOccupancy_${suffix}`)
        }));
    });
}

function buildLocalStopovers(responsesToExport) {
    return responsesToExport.flatMap((response, index) => {
        const responseId = getLocalResponseId(response, index);
        return Object.keys(response)
            .map(key => key.match(/^restRoute_(.+)$/))
            .filter(Boolean)
            .map(match => match[1])
            .sort(naturalLocalSort)
            .map(suffix => ({
                responseId,
                stopIndex: suffix,
                route: getLocalField(response, `restRoute_${suffix}`),
                location: getLocalField(response, `restLocation_${suffix}`),
                purpose: getLocalField(response, `restPurpose_${suffix}`),
                durationHours: getLocalField(response, `restDuration_${suffix}`),
                facilityType: getLocalField(response, `restAccom_${suffix}`),
                cost: getLocalField(response, `restCost_${suffix}`)
            }));
    });
}

function buildLocalLastMileTrips(responsesToExport) {
    return responsesToExport.flatMap((response, index) => {
        const responseId = getLocalResponseId(response, index);
        return getLocalSelectedDhams(response).map(dham => {
            const slug = localDhamSlug(dham);
            return {
                responseId,
                dham,
                route: getLocalField(response, `lastMileRoute_${slug}`),
                mode: getLocalField(response, `lastMileMode_${slug}`),
                timeHours: getLocalField(response, `lastMileTime_${slug}`),
                cost: getLocalField(response, `lastMileCost_${slug}`)
            };
        });
    });
}

function buildLocalChoiceResponses(responsesToExport) {
    return responsesToExport.flatMap((response, index) => {
        const responseId = getLocalResponseId(response, index);
        return Object.keys(response)
            .map(key => {
                const match = key.match(/^(main_haul|last_mile)_([A-Za-z]+)_Task(\d+)$/);
                if (!match) return null;
                const rawChoice = String(getLocalField(response, key));
                const split = rawChoice.split(':');
                return {
                    responseId,
                    experiment: match[1],
                    dham: match[2] === 'HemkundSahib' ? 'Hemkund Sahib' : match[2],
                    task: Number(match[3]),
                    chosenOptionCode: split[0] || '',
                    chosenOptionLabel: split.slice(1).join(':').trim()
                };
            })
            .filter(Boolean);
    });
}


/**
 * [FIX #2]
 * This is the new initialization block. It waits for the page
 * to be fully loaded, THEN it finds all the HTML elements
 * and assigns them to the global variables.
 * It also attaches all the necessary event listeners.
 */
document.addEventListener("DOMContentLoaded", async () => {
    // --- Assign all DOM elements to global variables ---
    form = document.getElementById("surveyForm");
    tableBody = document.querySelector("#responseTable tbody");
    const pageOrder = [
        'page-0-consent',
        'page-2-B',
        'page-3-C',
        'page-4-C-last-mile',
        'page-5-D',
        'page-1-A',
        'page-6-E',
        'page-7-thankyou'
    ];
    pages = pageOrder.map(id => document.getElementById(id)).filter(Boolean);
    steps = Array.from(document.getElementsByClassName("step"));
    pageBackground = document.getElementById("pageBackground");
    googleSheetTarget = document.getElementById("googleSheetTarget");
    primaryModeTableBody = document.querySelector('#primaryModeTable tbody');
    lastMileTableBody = document.querySelector('#lastMileTable tbody');
    stayDurationTableBody = document.querySelector('#stayDurationTable tbody');
    restLocationTableBody = document.querySelector('#restLocationTable tbody');
    dhamCheckboxes = document.querySelectorAll('.current-dham-checkbox');
    choiceBlockInput = document.getElementById('choiceBlock');
    googleTranslateElement = document.getElementById('google_translate_element');
    floatingTranslateMount = document.getElementById('floatingTranslateMount');
    consentTranslateMount = document.getElementById('consentTranslateMount');
    surveyStartTimestampInput = document.getElementById('surveyStartTimestamp');
    surveySubmitTimestampInput = document.getElementById('surveySubmitTimestamp');
    surveyCompletionSecondsInput = document.getElementById('surveyCompletionSeconds');

    lockEnglishOptionValues(form);
    initializeSurveyTiming();

    window.addEventListener('googleTranslateReady', () => updateTranslatePlacement(currentTab));

    await loadChoiceCardData();
    assignChoiceBlock();

    // --- Attach Event Listeners ---
    // These listeners replace the need for some `onclick` attributes
    
    // A4.1 Add Row
    document.getElementById("addPrimaryModeRow").addEventListener('click', addPrimaryModeRow);
    // A6 Add Row
    document.getElementById("addRestLocationRow").addEventListener('click', addRestLocationRow);
    // A2 Travel Type
    document.getElementById('travelType').addEventListener('change', handleTravelTypeChange);
    document.getElementById('startPoint').addEventListener('change', handleStartPointChange);
    document.getElementById('otherStartPoint').addEventListener('input', () => {
        updateMainHaulHeadings();
        updatePrimaryModeRouteCells();
    });
    form.addEventListener('change', event => {
        if (event.target.matches('select, input[type="checkbox"]')) {
            updateOtherSpecifyField(event.target);
        }
        if (event.target.matches('select[name^="lastMileMode_"]')) {
            handleLastMileModeChange(event.target);
        }
        if (event.target.matches('select[name^="mainHaulTransferCount_"]')) {
            updatePrimaryModeTable();
        }
        if (event.target.matches('input[name="kedarnath"], input[name="badrinath"], input[name="gangotri"], input[name="yamunotri"], input[name="hemkund"]')) {
            updateRepeatVisitReasonVisibility();
        }
    });
    document.getElementById('groupSize').addEventListener('input', validateGroupComposition);
    document.getElementById('groupCompositionFields').addEventListener('input', event => {
        if (event.target.matches('input[type="number"]')) {
            validateGroupComposition();
        }
    });
    document.getElementById('dhamSequenceSelection').addEventListener('change', event => {
        if (event.target.matches('select[name^="dhamSequence_"]')) {
            event.target.dataset.selectedDham = event.target.value;
            refreshDhamSequenceOptions();
        }
    });

    // A2 Dham Checkboxes
    dhamCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            updatePrimaryModeTable();
            updateRestLocationTable();
            updateDhamSequenceDropdowns();
            updateLastMileTable();
            initializeDCE(); // This will now be called correctly
        });
    });

    // Export Buttons
    document.getElementById("selectAllLocalResponses").addEventListener("click", selectAllLocalResponses);
    document.getElementById("deleteSelectedLocalResponses").addEventListener("click", deleteSelectedLocalResponses);
    document.getElementById("deleteAllLocalResponses").addEventListener("click", deleteAllLocalResponses);
    document.getElementById("exportCSV").addEventListener("click", exportToCSV);
    document.getElementById("exportXLSX").addEventListener("click", exportToXLSX);
    
    // --- Initialize App State ---
    responses = JSON.parse(localStorage.getItem("charDhamSurvey")) || [];
    renderTable();
    enhanceRatingTables();
    
    updatePrimaryModeTable();
    updateRestLocationTable();
    // Show the first page (Page 0)
    showTab(currentTab); 
    updateTranslatePlacement(currentTab);
    
    // Initialize group size logic
    handleTravelTypeChange();
    handleStartPointChange();
    updateMainHaulHeadings();
    updateRepeatVisitReasonVisibility();
    initializeOtherSpecifyFields();
});
