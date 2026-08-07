// Strips a currency input down to digits/decimal, then re-inserts thousands
// separators (e.g. "1000000" -> "1,000,000"). Keeps up to 2 decimal places.
function formatCurrencyInput(input) {
    const raw = input.value.replace(/[^\d.]/g, '');
    if (raw === '') {
        input.value = '';
        return;
    }

    const [wholeRaw, ...decimalParts] = raw.split('.');
    const whole = wholeRaw.replace(/^0+(?=\d)/, '') || '0';
    const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    if (decimalParts.length > 0) {
        const decimal = decimalParts.join('').slice(0, 2);
        input.value = `${formattedWhole}.${decimal}`;
    } else {
        input.value = formattedWhole;
    }
}

// Returns the numeric value of a formatted currency input (commas stripped).
function parseCurrencyInput(input) {
    const raw = input.value.replace(/[^\d.]/g, '');
    return raw === '' ? 0 : parseFloat(raw);
}

// Formats a currency input on load and keeps it formatted as the user types,
// preserving cursor position relative to the end of the value so typing/deleting
// in the middle of a number doesn't jump the caret. Shared by the static inputs
// below and any currency input added later by the dynamic expense-row lists.
function attachCurrencyInputBehavior(input) {
    formatCurrencyInput(input);
    input.addEventListener('input', () => {
        const distanceFromEnd = input.value.length - input.selectionStart;
        formatCurrencyInput(input);
        const newPos = input.value.length - distanceFromEnd;
        input.setSelectionRange(newPos, newPos);
    });
}

document.querySelectorAll('.currency-input').forEach(attachCurrencyInputBehavior);


// Strips a percent input down to digits and a single decimal point.
function formatPercentInput(input) {
    let raw = input.value.replace(/[^\d.-]/g, '');
    // Keep only the leading minus sign, if present.
    const negative = raw.startsWith('-');
    raw = raw.replace(/-/g, '');
    const firstDot = raw.indexOf('.');
    if (firstDot !== -1) {
        raw = raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, '');
    }
    input.value = (negative ? '-' : '') + raw;
}

// Clamps a percent input's value to the valid -100 to 100 range. The advanced
// stock-return dialog needs negative values for bad years, while the rest of
// the app only uses positive percentages.
function clampPercentInput(input) {
    if (input.value === '') {
        return;
    }
    const value = parseFloat(input.value);
    input.value = isNaN(value) ? '' : String(Math.min(100, Math.max(-100, value)));
}

function parsePercentInput(input) {
    const value = parseFloat(input.value);
    return isNaN(value) ? 0 : value;
}

// Bond % is derived from Stock % rather than entered directly.
function updateBondPercentage() {
    const stockValue = parsePercentInput(document.getElementById('stock-percentage'));
    document.getElementById('bond-percentage').value = String(100 - Math.min(100, Math.max(0, stockValue)));
}

document.querySelectorAll('.percent-input:not(#bond-percentage)').forEach((input) => {
    formatPercentInput(input);
    input.addEventListener('input', () => formatPercentInput(input));
    input.addEventListener('blur', () => clampPercentInput(input));
});

const stockPercentageInput = document.getElementById('stock-percentage');
stockPercentageInput.addEventListener('input', updateBondPercentage);
stockPercentageInput.addEventListener('blur', updateBondPercentage);
updateBondPercentage();

// These inputs only matter when there's a spouse to apply them to; disabling them
// when "has-spouse" is unchecked means users don't have to manually zero out each
// one to get a clean Single-filer projection.
const SPOUSE_ONLY_INPUT_IDS = [
    'widow-age', 'spouse-current-age', 'spouse-social-security-age', 'spouse-annuity-age',
    'social-security-secondary-benefit', 'annuity-secondary-income', 'pre-medicare-expenses-spouse',
    'spouse-other-income-start-age', 'spouse-other-income-stop-age', 'other-income-secondary-amount',
    'annuitized-spouse-auto-amount', 'annuitized-spouse-auto-end-age',
];

function updateSpouseInputsDisabled() {
    const hasSpouse = document.getElementById('has-spouse').checked;
    SPOUSE_ONLY_INPUT_IDS.forEach((id) => {
        document.getElementById(id).disabled = !hasSpouse;
    });
}

document.getElementById('has-spouse').addEventListener('change', updateSpouseInputsDisabled);
updateSpouseInputsDisabled();

// Field definitions for the two dynamic expense-row lists (Temporary and One Time
// expenses in the Expenses tab). Each list starts with a single row; users can
// add/remove rows via the +/- buttons at the end of each row (see the click
// delegation set up below), rather than a fixed number of rows.
const TEMPORARY_EXPENSE_FIELDS = [
    { suffix: 'start-age', label: 'Start Age', tooltip: 'Age at which this temporary expense begins', type: 'age', defaultValue: '60' },
    { suffix: 'end-age', label: 'End Age', tooltip: 'Age at which this temporary expense ends', type: 'age', defaultValue: '75' },
    { suffix: 'amount', label: 'Monthly', tooltip: 'Monthly amount for this temporary expense. Set to 0 if not applicable.', type: 'currency', defaultValue: '0' },
];
const ONE_TIME_EXPENSE_FIELDS = [
    { suffix: 'age', label: 'Age', tooltip: 'Age of the primary when this one-time expense occurs', type: 'age', defaultValue: '60' },
    { suffix: 'amount', label: 'Annual', tooltip: 'Total amount for this one-time expense. Set to 0 if not applicable.', type: 'currency', defaultValue: '0' },
];
const EXPENSE_ROW_LISTS = {
    'temporary-expenses-list': {
        idPrefix: 'temporary-expense', fields: TEMPORARY_EXPENSE_FIELDS,
        addLabel: 'Add temporary expense', removeLabel: 'Remove temporary expense',
    },
    'one-time-expenses-list': {
        idPrefix: 'one-time-expense', fields: ONE_TIME_EXPENSE_FIELDS,
        addLabel: 'Add one-time expense', removeLabel: 'Remove one-time expense',
    },
};

function buildExpenseFieldHtml(idPrefix, rowNumber, field) {
    const id = `${idPrefix}-${rowNumber}-${field.suffix}`;
    if (field.type === 'currency') {
        return `
            <div class="input-group">
                <label for="${id}">${field.label}
                    <span class="tooltip">?<span class="tooltip-text">${field.tooltip}</span></span>
                </label>
                <div class="currency-input-wrapper">
                    <span class="currency-symbol">$</span>
                    <input type="text" inputmode="decimal" class="currency-input" id="${id}" name="${id}"
                        value="${field.defaultValue}" placeholder="e.g., 0" />
                </div>
            </div>`;
    }
    return `
        <div class="input-group">
            <label for="${id}">${field.label}
                <span class="tooltip">?<span class="tooltip-text">${field.tooltip}</span></span>
            </label>
            <input type="number" id="${id}" name="${id}" min="1" max="120" value="${field.defaultValue}"
                placeholder="e.g., ${field.defaultValue}" />
        </div>`;
}

function buildExpenseRowHtml(config, rowNumber) {
    const fieldsHtml = config.fields.map((field) => buildExpenseFieldHtml(config.idPrefix, rowNumber, field)).join('');
    return `
        <div class="expense-row">
            <div class="expense-row-label" role="button" tabindex="0"
                title="Click to rename this expense">Expense ${rowNumber}</div>
            <div class="top-input-grid horizontal">
                ${fieldsHtml}
                <div class="expense-row-actions">
                    <span class="expense-row-actions-label">Actions</span>
                    <div class="expense-row-actions-buttons">
                        <button type="button" class="expense-row-btn expense-row-add"
                            aria-label="${config.addLabel}">+</button>
                        <button type="button" class="expense-row-btn expense-row-remove"
                            aria-label="${config.removeLabel}">&minus;</button>
                    </div>
                </div>
            </div>
        </div>`;
}

function attachExpenseLabelRenameBehavior(label) {
    if (!label) {
        return;
    }
    label.addEventListener('click', () => {
        const current = label.textContent || '';
        const newName = window.prompt('Enter a name for this expense:', current);
        if (newName !== null && newName.trim() !== '') {
            label.textContent = newName.trim();
            label.dataset.customName = 'true';
        } else if (newName !== null && newName.trim() === '') {
            delete label.dataset.customName;
        }
    });
    label.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            label.click();
        }
    });
}

// Attach rename behavior to the static "Expense 1" rows that exist in the
// initial HTML; dynamically created rows get it in createExpenseRowElement.
document.querySelectorAll('.expense-row-label').forEach(attachExpenseLabelRenameBehavior);

function createExpenseRowElement(config, rowNumber) {
    const template = document.createElement('template');
    template.innerHTML = buildExpenseRowHtml(config, rowNumber).trim();
    const rowElement = template.content.firstElementChild;
    rowElement.querySelectorAll('.currency-input').forEach(attachCurrencyInputBehavior);
    attachExpenseLabelRenameBehavior(rowElement.querySelector('.expense-row-label'));
    return rowElement;
}

// Keeps each row's field ids/names/label-for sequential (1..count) after any
// add/remove, and disables the remove button on the only remaining row so at
// least one row always stays. Custom expense names are preserved.
function renumberExpenseRows(containerId) {
    const config = EXPENSE_ROW_LISTS[containerId];
    const rows = Array.from(document.getElementById(containerId).children);
    rows.forEach((row, index) => {
        const rowNumber = index + 1;
        const label = row.querySelector('.expense-row-label');
        // Only reset the label if the user hasn't given it a custom name.
        if (!label.dataset.customName) {
            label.textContent = `Expense ${rowNumber}`;
        }
        row.querySelectorAll('.input-group').forEach((group, fieldIndex) => {
            const field = config.fields[fieldIndex];
            const id = `${config.idPrefix}-${rowNumber}-${field.suffix}`;
            group.querySelector('label').setAttribute('for', id);
            const input = group.querySelector('input');
            input.id = id;
            input.name = id;
        });
        row.querySelector('.expense-row-remove').disabled = rows.length <= 1;
    });
}

// Collects the current text of each dynamic expense-row label so custom names
// can be persisted and restored alongside row counts.
function collectExpenseLabels() {
    const labels = {};
    Object.keys(EXPENSE_ROW_LISTS).forEach((containerId) => {
        labels[containerId] = Array.from(document.getElementById(containerId).children).map(
            (row) => row.querySelector('.expense-row-label').textContent
        );
    });
    return labels;
}

// Applies saved expense-row labels after rows are rebuilt. When no labels are
// provided (e.g. Load Defaults), clears any custom names so labels revert to
// "Expense N".
function applyExpenseLabels(labelsByContainer) {
    Object.keys(EXPENSE_ROW_LISTS).forEach((containerId) => {
        const savedLabels = labelsByContainer && labelsByContainer[containerId];
        const rows = Array.from(document.getElementById(containerId).children);
        rows.forEach((row, index) => {
            const label = row.querySelector('.expense-row-label');
            const saved = savedLabels && savedLabels[index];
            if (saved) {
                label.textContent = saved;
                label.dataset.customName = 'true';
            } else {
                delete label.dataset.customName;
            }
        });
        renumberExpenseRows(containerId);
    });
}

// Rebuilds a list down to exactly `count` rows -- used by Load Defaults and preset
// loading, since the saved/default row count may differ from what's currently
// in the DOM (rows may have been added/removed since).
function setExpenseRowCount(containerId, count) {
    const config = EXPENSE_ROW_LISTS[containerId];
    const container = document.getElementById(containerId);
    const targetCount = Math.max(1, count);
    while (container.children.length > targetCount) {
        container.lastElementChild.remove();
    }
    while (container.children.length < targetCount) {
        container.appendChild(createExpenseRowElement(config, container.children.length + 1));
    }
    renumberExpenseRows(containerId);
}

// Reads however many rows currently exist in a dynamic expense-row list, rather
// than a hardcoded count, since rows can be added/removed by the user.
function readExpenseRows(containerId, mapRow) {
    const rowCount = document.getElementById(containerId).children.length;
    return Array.from({ length: rowCount }, (_, index) => mapRow(index + 1));
}

Object.keys(EXPENSE_ROW_LISTS).forEach((containerId) => {
    document.getElementById(containerId).addEventListener('click', (event) => {
        const addBtn = event.target.closest('.expense-row-add');
        const removeBtn = event.target.closest('.expense-row-remove');
        const container = document.getElementById(containerId);
        if (addBtn) {
            const config = EXPENSE_ROW_LISTS[containerId];
            addBtn.closest('.expense-row').after(createExpenseRowElement(config, container.children.length + 1));
            renumberExpenseRows(containerId);
        } else if (removeBtn && container.children.length > 1) {
            removeBtn.closest('.expense-row').remove();
            renumberExpenseRows(containerId);
        }
    });
});

// Manually restore each field's original HTML value (defaultValue) instead of using a
// native reset button, since the browser's "reset" event fires *before* fields are
// reset, which would reformat stale values instead of the restored defaults.
document.getElementById('reset-btn').addEventListener('click', () => {
    Object.keys(EXPENSE_ROW_LISTS).forEach((containerId) => setExpenseRowCount(containerId, 1));
    applyExpenseLabels();
    document.querySelectorAll('#retirement-form input').forEach((input) => {
        if (input.type === 'checkbox') {
            input.checked = input.defaultChecked;
        } else {
            input.value = input.defaultValue;
        }
    });
    document.querySelectorAll('.currency-input').forEach(formatCurrencyInput);
    document.querySelectorAll('.percent-input:not(#bond-percentage)').forEach(formatPercentInput);
    updateBondPercentage();
    updateSpouseInputsDisabled();
});

const USER_PRESET_KEY = 'retirementToolUserPreset';

// Collect every input's current value so it can be persisted in localStorage.
function collectInputValues() {
    const values = {};
    document.querySelectorAll('#retirement-form input').forEach((input) => {
        if (input.type === 'checkbox') {
            values[input.id] = input.checked;
        } else {
            values[input.id] = input.value;
        }
    });
    // Row counts for the dynamic expense-row lists aren't inputs themselves, so
    // they're stashed separately -- applyInputValues needs these to rebuild the
    // right number of rows before it can fill in each row's own field values.
    values._expenseRowCounts = {};
    Object.keys(EXPENSE_ROW_LISTS).forEach((containerId) => {
        values._expenseRowCounts[containerId] = document.getElementById(containerId).children.length;
    });
    values._expenseLabels = collectExpenseLabels();
    return values;
}

// Apply a previously-collected set of input values and reformat fields that need
// currency/percent formatting or derived state (bond %, disabled spouse inputs).
function applyInputValues(values) {
    if (!values) {
        return;
    }
    const expenseRowCounts = values._expenseRowCounts || {};
    Object.keys(EXPENSE_ROW_LISTS).forEach((containerId) => {
        setExpenseRowCount(containerId, expenseRowCounts[containerId] || 1);
    });
    applyExpenseLabels(values._expenseLabels);
    document.querySelectorAll('#retirement-form input').forEach((input) => {
        if (!(input.id in values)) {
            return;
        }
        if (input.type === 'checkbox') {
            input.checked = values[input.id];
        } else {
            input.value = values[input.id];
        }
    });
    document.querySelectorAll('.currency-input').forEach(formatCurrencyInput);
    document.querySelectorAll('.percent-input:not(#bond-percentage)').forEach(formatPercentInput);
    updateBondPercentage();
    updateSpouseInputsDisabled();
}

function saveUserPreset() {
    try {
        localStorage.setItem(USER_PRESET_KEY, JSON.stringify(collectInputValues()));
        alert('User preset saved.');
    } catch (error) {
        console.error('Failed to save user preset:', error);
        alert('Could not save preset. Browser storage may be disabled or full.');
    }
}

function loadUserPreset() {
    try {
        const stored = localStorage.getItem(USER_PRESET_KEY);
        if (stored === null) {
            alert('No user preset found.');
            return;
        }
        applyInputValues(JSON.parse(stored));
    } catch (error) {
        console.error('Failed to load user preset:', error);
        alert('Could not load preset.');
    }
}

function loadUserPresetOnStartup() {
    try {
        const stored = localStorage.getItem(USER_PRESET_KEY);
        if (stored !== null) {
            applyInputValues(JSON.parse(stored));
        }
    } catch (error) {
        console.error('Failed to load user preset on startup:', error);
    }
}

document.getElementById('save-user-preset-btn').addEventListener('click', saveUserPreset);
document.getElementById('load-user-preset-btn').addEventListener('click', loadUserPreset);
loadUserPresetOnStartup();

// Advanced Stock Returns modal: let users override the single Stock Returns %
// with a per-projection-year stock return. Pre-retirement growth always uses
// the main Stock Returns %; only the projection-year account growth is affected.
const advancedStockReturnsModal = document.getElementById('advanced-stock-returns-modal');
const advancedStockReturnsGrid = document.getElementById('advanced-stock-returns-grid');
const advancedStockReturnsAverage = document.getElementById('advanced-stock-returns-average');
const useAdvancedStockReturnsCheckbox = document.getElementById('use-advanced-stock-returns');
const openAdvancedStockReturnsBtn = document.getElementById('open-advanced-stock-returns-btn');

function updateAdvancedStockReturnsButtonState() {
    openAdvancedStockReturnsBtn.disabled = !useAdvancedStockReturnsCheckbox.checked;
}

useAdvancedStockReturnsCheckbox.addEventListener('change', updateAdvancedStockReturnsButtonState);
updateAdvancedStockReturnsButtonState();

function populateAdvancedStockReturnsModal() {
    const projectionYears = parseFloat(document.getElementById('projection-years').value) || 0;
    const retirementAge = parseFloat(document.getElementById('retirement-age').value) || 0;
    const defaultReturn = document.getElementById('stock-return-percentage').value;

    // Preserve any values the user has already entered so reopening the modal
    // doesn't wipe out their customizations.
    const existingValues = {};
    advancedStockReturnsGrid.querySelectorAll('.advanced-stock-return-input').forEach((input, index) => {
        existingValues[index] = input.value;
    });

    advancedStockReturnsGrid.innerHTML = '';

    for (let i = 0; i < projectionYears; i++) {
        const year = i + 1;
        const age = retirementAge + i;
        const value = existingValues[i] !== undefined ? existingValues[i] : defaultReturn;

        const row = document.createElement('div');
        row.className = 'advanced-stock-return-row';
        row.innerHTML = `
            <label for="advanced-stock-return-year-${year}">Year ${year} (Age ${age})</label>
            <div class="percent-input-wrapper">
                <input type="text" inputmode="decimal" class="percent-input advanced-stock-return-input"
                    id="advanced-stock-return-year-${year}" name="advanced-stock-return-year-${year}"
                    value="${value}" placeholder="e.g., 7" />
                <span class="percent-symbol">%</span>
            </div>
        `;
        advancedStockReturnsGrid.appendChild(row);
    }

    updateAdvancedStockReturnsAverage();
}

function updateAdvancedStockReturnsAverage() {
    const inputs = advancedStockReturnsGrid.querySelectorAll('.advanced-stock-return-input');
    if (inputs.length === 0) {
        advancedStockReturnsAverage.textContent = '0.0%';
        return;
    }
    let product = 1;
    inputs.forEach((input) => {
        product *= 1 + parsePercentInput(input) / 100;
    });
    const cagr = (Math.pow(product, 1 / inputs.length) - 1) * 100;
    advancedStockReturnsAverage.textContent = `${cagr.toFixed(1)}%`;
}

advancedStockReturnsGrid.addEventListener('input', (event) => {
    if (event.target.classList.contains('advanced-stock-return-input')) {
        const distanceFromEnd = event.target.value.length - event.target.selectionStart;
        formatPercentInput(event.target);
        const newPos = event.target.value.length - distanceFromEnd;
        event.target.setSelectionRange(newPos, newPos);
        updateAdvancedStockReturnsAverage();
    }
});

advancedStockReturnsGrid.addEventListener('blur', (event) => {
    if (event.target.classList.contains('advanced-stock-return-input')) {
        clampPercentInput(event.target);
    }
}, true);

openAdvancedStockReturnsBtn.addEventListener('click', () => {
    populateAdvancedStockReturnsModal();
    advancedStockReturnsModal.showModal();
});

// Builds a non-uniform sequence of annual returns whose compounded effect over
// `sequenceYears` equals the requested totalChange (e.g. -0.40 for a 40% drop).
// The sequence is front-loaded: the first year is the largest move, and each
// subsequent year decays toward zero, then a final small adjustment is applied
// to exactly hit the target compounded change. Remaining projection years are
// filled with the default stock return %.
function generateCustomSequence() {
    const inputs = advancedStockReturnsGrid.querySelectorAll('.advanced-stock-return-input');
    const projectionYears = inputs.length;
    if (projectionYears === 0) {
        return;
    }

    const totalChange = parsePercentInput(document.getElementById('sequence-total-change')) / 100;
    if (Number.isNaN(totalChange)) {
        alert('Invalid total change entered.');
        return;
    }

    const sequenceYears = Math.max(1, Math.min(projectionYears, parseInt(document.getElementById('sequence-years').value, 10) || 0));
    if (Number.isNaN(sequenceYears) || sequenceYears <= 0) {
        alert('Invalid number of years entered.');
        return;
    }

    const targetReturn = parsePercentInput(document.getElementById('stock-return-percentage')) / 100;
    const values = new Array(projectionYears).fill(targetReturn * 100);

    if (sequenceYears === 1) {
        values[0] = totalChange * 100;
    } else {
        // Target growth factor over the sequence (e.g. -0.40 => factor 0.60).
        const targetFactor = 1 + totalChange;

        // Generate a decaying sequence of returns. For a loss, each year is
        // negative; for a gain, each year is positive. Decay from the first year
        // toward zero to avoid a uniform percentage.
        const firstYear = totalChange / sequenceYears * 2.5;
        const decay = 0.55;
        const trialReturns = [];
        let current = firstYear;
        for (let i = 0; i < sequenceYears; i++) {
            trialReturns.push(current);
            current *= decay;
        }

        // Compute the trial growth factor and apply an equal adjustment to each
        // year so the final compounded result exactly matches the target.
        const trialFactor = trialReturns.reduce((product, r) => product * (1 + r), 1);
        const adjustment = Math.pow(targetFactor / trialFactor, 1 / sequenceYears) - 1;
        for (let i = 0; i < sequenceYears; i++) {
            values[i] = (trialReturns[i] + adjustment) * 100;
        }
    }

    // Fill the remaining years with a recovery sequence whose compounded return
    // brings the full projection's CAGR back to the basic stock return %. This is
    // computed as a uniform return over the remaining years for stability.
    const remainingYears = projectionYears - sequenceYears;
    if (remainingYears > 0) {
        const fullTargetFactor = Math.pow(1 + targetReturn, projectionYears);
        const sequenceFactor = values.slice(0, sequenceYears).reduce(
            (product, r) => product * (1 + r / 100), 1
        );
        const recoveryFactor = fullTargetFactor / sequenceFactor;
        const recoveryReturn = (Math.pow(recoveryFactor, 1 / remainingYears) - 1) * 100;
        for (let i = sequenceYears; i < projectionYears; i++) {
            values[i] = recoveryReturn;
        }
    }

    inputs.forEach((input, index) => {
        input.value = String(Number(values[index].toFixed(2)));
    });

    updateAdvancedStockReturnsAverage();
}

document.getElementById('generate-sequence-btn').addEventListener('click', generateCustomSequence);

document.getElementById('reset-advanced-stock-returns-btn').addEventListener('click', () => {
    const defaultReturn = document.getElementById('stock-return-percentage').value;
    advancedStockReturnsGrid.querySelectorAll('.advanced-stock-return-input').forEach((input) => {
        input.value = defaultReturn;
    });
    updateAdvancedStockReturnsAverage();
});

document.querySelectorAll('#advanced-stock-returns-modal .modal-close').forEach((button) => {
    button.addEventListener('click', () => advancedStockReturnsModal.close());
});

advancedStockReturnsModal.addEventListener('click', (event) => {
    const rect = advancedStockReturnsModal.getBoundingClientRect();
    const clickedInsideContent =
        event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!clickedInsideContent) {
        advancedStockReturnsModal.close();
    }
});

// Allow users to click a row in any projection table to highlight it. Clicking
// the same row again removes the highlight, and clicking a different row moves
// the highlight to that row.
document.querySelectorAll('.projection-table').forEach((table) => {
    table.addEventListener('click', (event) => {
        const clickedRow = event.target.closest('tbody tr');
        if (!clickedRow) {
            return;
        }
        const currentlySelected = table.querySelector('tbody tr.selected-row');
        if (currentlySelected === clickedRow) {
            clickedRow.classList.remove('selected-row');
        } else {
            if (currentlySelected) {
                currentlySelected.classList.remove('selected-row');
            }
            clickedRow.classList.add('selected-row');
        }
    });
});

// Input sections (Ages/Rates/Portfolio/Roth Conversions/Income/Expenses) and
// result sections (Summary/Expenses/Annuity/Social Security/Withdrawals/Taxes)
// each have their own independent tab-list + tab-panels pair; scope switching to
// the clicked button's own group so the two tab groups don't affect each other.
document.querySelectorAll('.tab-list').forEach((tabList) => {
    const panels = tabList.nextElementSibling;
    tabList.querySelectorAll('.tab-button').forEach((button) => {
        button.addEventListener('click', () => {
            tabList.querySelectorAll('.tab-button').forEach((otherButton) => {
                otherButton.classList.remove('active');
                otherButton.setAttribute('aria-selected', 'false');
            });
            button.classList.add('active');
            button.setAttribute('aria-selected', 'true');

            panels.querySelectorAll('.tab-panel').forEach((panel) => {
                panel.hidden = panel.id !== button.dataset.tab;
            });
        });
    });
});

// Tax Tables modal: rarely-edited settings tucked behind a native <dialog> instead
// of cluttering the main form.
const taxTablesModal = document.getElementById('tax-tables-modal');

document.getElementById('open-tax-tables-btn').addEventListener('click', () => {
    taxTablesModal.showModal();
});

document.querySelectorAll('.modal-close').forEach((button) => {
    button.addEventListener('click', () => taxTablesModal.close());
});

// Close when clicking the ::backdrop (its click target is the <dialog> itself, not a
// child), by checking whether the click occurred outside the dialog's content box.
taxTablesModal.addEventListener('click', (event) => {
    const rect = taxTablesModal.getBoundingClientRect();
    const clickedInsideContent =
        event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!clickedInsideContent) {
        taxTablesModal.close();
    }
});

// Grows a starting balance to retirement using monthly-compounded stock/bond
// returns, adding a monthly contribution (split across stock/bond in the same
// proportion as the balance) each month. Monthly compounding is used instead of
// a single annual lump-sum growth step because contributions actually arrive
// throughout the year and should start compounding as soon as they land.
// Returns the stock/bond sub-balances separately (rather than their sum) since
// differing returns drift the split away from stockFraction/bondFraction, and
// the withdrawal simulation below needs each account's actual stock/bond mix.
function projectAccountBalance(
    startingBalance, monthlyContribution, stockFraction, bondFraction,
    monthlyStockReturn, monthlyBondReturn, months
) {
    let stock = startingBalance * stockFraction;
    let bond = startingBalance * bondFraction;
    const contributionStock = monthlyContribution * stockFraction;
    const contributionBond = monthlyContribution * bondFraction;

    for (let month = 0; month < months; month++) {
        stock = stock * (1 + monthlyStockReturn) + contributionStock;
        bond = bond * (1 + monthlyBondReturn) + contributionBond;
    }

    return { stock, bond };
}

// Withdraws up to `amount` from an account's stock/bond sub-balances, in
// proportion to its current stock/bond split, mutating the account in place.
// Returns the amount actually withdrawn (less than requested once the account
// runs dry), so the caller can carry any remainder to the next account.
function withdrawFromAccount(account, amount) {
    const balance = account.stock + account.bond;
    if (amount <= 0 || balance <= 0) {
        return 0;
    }

    const withdrawn = Math.min(amount, balance);
    const stockShare = account.stock / balance;
    account.stock -= withdrawn * stockShare;
    account.bond -= withdrawn * (1 - stockShare);
    return withdrawn;
}

// Grows an account's stock/bond sub-balances for the given number of months;
// no further contributions are assumed once withdrawals have started.
function growAccount(account, monthlyStockReturn, monthlyBondReturn, months) {
    for (let month = 0; month < months; month++) {
        account.stock *= 1 + monthlyStockReturn;
        account.bond *= 1 + monthlyBondReturn;
    }
}

// Deposits an amount into an account's stock/bond sub-balances, in proportion to
// its current split (50/50 if the account is currently empty), mutating it in
// place -- the inverse of withdrawFromAccount, used for Roth conversions.
function depositToAccount(account, amount) {
    if (amount <= 0) {
        return;
    }
    const balance = account.stock + account.bond;
    const stockShare = balance > 0 ? account.stock / balance : 0.5;
    account.stock += amount * stockShare;
    account.bond += amount * (1 - stockShare);
}

// Formats a plain number as whole-dollar currency for read-only result display.
function formatResultCurrency(value) {
    return `$${Math.round(value).toLocaleString()}`;
}

// Formats a 0-1 fraction as a percentage for read-only result display.
function formatResultPercent(value) {
    return `${(value * 100).toFixed(1)}%`;
}

// Compact single-column Age display shared by all projection tables: just the
// primary's age when unmarried, "primary / spouse" when married, or "&dagger; /
// spouse" once the spouse has outlived the primary (widow age reached).
function formatAgeCell(primaryAge, spouseAge, hasSpouse, isWidowed) {
    const primaryAgeDisplay = isWidowed ? '&dagger;' : String(primaryAge);
    return hasSpouse ? `${primaryAgeDisplay} / ${spouseAge}` : primaryAgeDisplay;
}

// Splits a per-person value pair (medical expenses, IRMAA, etc.) into a single
// cell: just the primary's value when unmarried, just the spouse's once widowed
// (the primary's own value is $0 by then anyway), or "primary / spouse" otherwise.
function formatSplitCell(primaryValue, spouseValue, hasSpouse, isWidowed, formatFn) {
    if (!hasSpouse) {
        return formatFn(primaryValue);
    }
    return isWidowed ? formatFn(spouseValue) : `${formatFn(primaryValue)} / ${formatFn(spouseValue)}`;
}

// Calculates one projection year's expenses. Inputs are assumed to be given in
// today's (primary's current age) dollars; when not showing "today's dollars",
// they're inflated up to that year's nominal amount using yearsFromToday, which
// spans from the primary's current age through the given projection year.
function calculateExpenseYear(yearIndex, context) {
    const primaryAge = context.retirementAge + (yearIndex - 1);
    const spouseAge = context.spouseAgeAtRetirement + (yearIndex - 1);

    const common = context.monthlyExpenses * 12;
    let primaryPreMedicare = primaryAge < 65 ? context.primaryPreMedicareExpenses * 12 : 0;
    // No spouse means no spouse expenses at all, regardless of what's left in that field.
    const spousePreMedicare = (context.hasSpouse && spouseAge < 65) ? context.spousePreMedicareExpenses * 12 : 0;
    // Part B is a fixed per-person premium once Medicare eligibility starts at 65;
    // Part D is excluded since its premium varies widely by plan.
    let primaryMedicare = primaryAge >= 65 ? context.medicarePartBPremium * 12 : 0;
    const spouseMedicare = (context.hasSpouse && spouseAge >= 65) ? context.medicarePartBPremium * 12 : 0;
    const temporaryExpenses = context.temporaryExpenses.map((expense) =>
        (primaryAge >= expense.startAge && primaryAge <= expense.endAge) ? expense.amount * 12 : 0
    );
    const oneTimeExpenses = context.oneTimeExpenses.map((expense) =>
        (expense.age > 0 && primaryAge === expense.age) ? expense.amount : 0
    );

    // Annuitized expenses start at retirement and run until the relevant person's
    // end age. They are fixed nominal payments (no inflation adjustment), so real
    // display values are deflated just like annuity income.
    const annuitized = context.annuitizedExpenses || {};
    let mortgageExpense = 0;
    if (annuitized.mortgage && primaryAge <= annuitized.mortgage.endAge) {
        mortgageExpense = annuitized.mortgage.amount * 12;
    }
    let primaryAutoExpense = 0;
    if (annuitized.primaryAuto && primaryAge <= annuitized.primaryAuto.endAge) {
        primaryAutoExpense = annuitized.primaryAuto.amount * 12;
    }
    let spouseAutoExpense = 0;
    if (context.hasSpouse && annuitized.spouseAuto && primaryAge <= annuitized.spouseAuto.endAge) {
        spouseAutoExpense = annuitized.spouseAuto.amount * 12;
    }
    const annuitizedTotalNominal = mortgageExpense + primaryAutoExpense + spouseAutoExpense;

    // Primary is assumed deceased once the spouse reaches widow age, so his own
    // Medicare/pre-Medicare costs stop (the spouse's are unaffected). Only
    // applicable when there's actually a spouse to survive him.
    if (context.hasSpouse && context.widowAge > 0 && spouseAge >= context.widowAge) {
        primaryPreMedicare = 0;
        primaryMedicare = 0;
        mortgageExpense = 0;
        primaryAutoExpense = 0;
    }

    const yearsFromToday = context.yearsToRetirement + (yearIndex - 1);
    // nominalFactor is always applied (unlike inflationFactor below) since the
    // withdrawal simulation needs true nominal dollars regardless of display mode.
    const nominalFactor = Math.pow(1 + context.inflationRate, yearsFromToday);
    const inflationFactor = context.showTodaysDollars ? 1 : nominalFactor;

    // IRMAA (based on projected income from 2 years prior -- see getIrmaaMonthlySurcharge)
    // arrives already expressed in this year's nominal dollars, unlike the inputs
    // above (entered in today's dollars and inflated forward via inflationFactor),
    // so it needs the inverse -- deflated for today's-dollars display, left alone
    // for nominal -- instead of being inflated a second time.
    const irmaaMonthlySurcharge = context.irmaaMonthlySurchargeByYear[yearIndex - 1] ?? 0;
    let primaryIrmaaNominal = primaryAge >= 65 ? irmaaMonthlySurcharge * 12 : 0;
    const spouseIrmaaNominal = (context.hasSpouse && spouseAge >= 65) ? irmaaMonthlySurcharge * 12 : 0;
    if (context.hasSpouse && context.widowAge > 0 && spouseAge >= context.widowAge) {
        primaryIrmaaNominal = 0;
    }
    const irmaaSurchargeNominal = primaryIrmaaNominal + spouseIrmaaNominal;
    const deflationFactor = context.showTodaysDollars ? 1 / nominalFactor : 1;

    const rawTotal = common + primaryPreMedicare + spousePreMedicare + primaryMedicare + spouseMedicare +
        temporaryExpenses.reduce((sum, value) => sum + value, 0) +
        oneTimeExpenses.reduce((sum, value) => sum + value, 0);
    const total = rawTotal * inflationFactor + annuitizedTotalNominal * deflationFactor +
        irmaaSurchargeNominal * deflationFactor;

    return {
        year: yearIndex,
        primaryAge,
        spouseAge,
        hasSpouse: context.hasSpouse,
        // Marks the primary as presumed deceased for the Age column's dagger marker.
        isWidowed: context.hasSpouse && context.widowAge > 0 && spouseAge >= context.widowAge,
        common: common * inflationFactor,
        // Pre-Medicare and Medicare premium are mutually exclusive per person (age
        // 65 is the cutover), so they collapse into one figure per person here.
        primaryMedicalExpense: (primaryPreMedicare + primaryMedicare) * inflationFactor,
        spouseMedicalExpense: (spousePreMedicare + spouseMedicare) * inflationFactor,
        primaryIrmaa: primaryIrmaaNominal * deflationFactor,
        spouseIrmaa: spouseIrmaaNominal * deflationFactor,
        temporaryExpenses: temporaryExpenses.map((value) => value * inflationFactor),
        oneTimeExpenses: oneTimeExpenses.map((value) => value * inflationFactor),
        annuitized: annuitizedTotalNominal * deflationFactor,
        total,
        totalNominal: rawTotal * nominalFactor + annuitizedTotalNominal + irmaaSurchargeNominal,
    };
}

function renderExpenseProjectionTable(rows) {
    const tbody = document.getElementById('expense-projection-tbody');
    tbody.innerHTML = '';

    rows.forEach((row) => {
        const ageCell = formatAgeCell(row.primaryAge, row.spouseAge, row.hasSpouse, row.isWidowed);
        const medicalCell = formatResultCurrency(row.primaryMedicalExpense + row.spouseMedicalExpense);
        const irmaaCell = formatResultCurrency(row.primaryIrmaa + row.spouseIrmaa);
        // Summed rather than shown per-item since the number of temporary/one-time
        // expenses is now variable (users can add/remove rows).
        const temporaryCell = formatResultCurrency(row.temporaryExpenses.reduce((sum, value) => sum + value, 0));
        const oneTimeCell = formatResultCurrency(row.oneTimeExpenses.reduce((sum, value) => sum + value, 0));
        const annuitizedCell = formatResultCurrency(row.annuitized);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.year}</td>
            <td>${ageCell}</td>
            <td>${formatResultCurrency(row.common)}</td>
            <td>${medicalCell}</td>
            <td>${irmaaCell}</td>
            <td>${temporaryCell}</td>
            <td>${oneTimeCell}</td>
            <td>${annuitizedCell}</td>
            <td class="total-cell">${formatResultCurrency(row.total)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Annuity payments are fixed nominal amounts once they start (no inflation raises).
// So in nominal mode the payment stays flat, but in "today's dollars" mode its
// purchasing power shrinks over time, so we deflate it instead of inflating it.
function calculateAnnuityYear(yearIndex, context) {
    const primaryAge = context.retirementAge + (yearIndex - 1);
    const spouseAge = context.spouseAgeAtRetirement + (yearIndex - 1);

    let primaryAnnuity = primaryAge >= context.primaryAnnuityAge ? context.primaryAnnuityIncome * 12 : 0;
    const spouseAnnuity = (context.hasSpouse && spouseAge >= context.spouseAnnuityAge) ? context.spouseAnnuityIncome * 12 : 0;

    // Primary is assumed deceased once the spouse reaches widow age; no survivor
    // benefit carries over for the annuity, it simply stops. Only applicable when
    // there's actually a spouse to survive him.
    if (context.hasSpouse && context.widowAge > 0 && spouseAge >= context.widowAge) {
        primaryAnnuity = 0;
    }

    const yearsFromToday = context.yearsToRetirement + (yearIndex - 1);
    const deflationFactor = context.showTodaysDollars
        ? 1 / Math.pow(1 + context.inflationRate, yearsFromToday)
        : 1;

    return {
        year: yearIndex,
        primaryAge,
        spouseAge,
        hasSpouse: context.hasSpouse,
        isWidowed: context.hasSpouse && context.widowAge > 0 && spouseAge >= context.widowAge,
        primaryAnnuity: primaryAnnuity * deflationFactor,
        spouseAnnuity: spouseAnnuity * deflationFactor,
        total: (primaryAnnuity + spouseAnnuity) * deflationFactor,
        // Already nominal (flat, non-COLA'd) -- no factor needed for the withdrawal simulation.
        totalNominal: primaryAnnuity + spouseAnnuity,
    };
}

// Social Security's full retirement age (FRA) for anyone retiring in the
// projection window covered by this tool.
const SOCIAL_SECURITY_FULL_RETIREMENT_AGE = 67;

// Adjusts the benefit given at full retirement age for claiming early or late.
// Early: reduced 5/9 of 1% per month for the first 36 months early, then 5/12 of
// 1% per month beyond that (this is the standard SSA formula, and produces the
// well-known 30% reduction at age 62 for an FRA of 67). Late: increased 2/3 of 1%
// per month (8%/year) up to age 70, when delayed credits stop accruing.
function calculateSocialSecurityMonthlyBenefit(benefitAtFullRetirementAge, claimAge) {
    if (claimAge < SOCIAL_SECURITY_FULL_RETIREMENT_AGE) {
        const monthsEarly = (SOCIAL_SECURITY_FULL_RETIREMENT_AGE - claimAge) * 12;
        const first36Months = Math.min(monthsEarly, 36);
        const additionalMonths = Math.max(monthsEarly - 36, 0);
        const reduction = first36Months * (5 / 9 / 100) + additionalMonths * (5 / 12 / 100);
        return benefitAtFullRetirementAge * (1 - reduction);
    }

    const monthsLate = (Math.min(claimAge, 70) - SOCIAL_SECURITY_FULL_RETIREMENT_AGE) * 12;
    const increase = monthsLate * (2 / 3 / 100);
    return benefitAtFullRetirementAge * (1 + increase);
}

// Unlike the annuity, Social Security gets automatic COLA increases that track
// inflation, so its real purchasing power stays constant at today's-dollars value.
// That means (like Expenses) we inflate up to nominal dollars when *not* showing
// today's dollars, rather than deflating when we are.
function calculateSocialSecurityYear(yearIndex, context) {
    const primaryAge = context.retirementAge + (yearIndex - 1);
    const spouseAge = context.spouseAgeAtRetirement + (yearIndex - 1);

    let primarySS = primaryAge >= context.primaryClaimAge ? context.primaryMonthlyBenefit * 12 : 0;
    let spouseSS = (context.hasSpouse && spouseAge >= context.spouseClaimAge) ? context.spouseMonthlyBenefit * 12 : 0;

    // Primary is assumed deceased once the spouse reaches widow age; the widow
    // steps up to whichever of the two (claim-age-adjusted) benefits is larger.
    // Only applicable when there's actually a spouse to survive him.
    if (context.hasSpouse && context.widowAge > 0 && spouseAge >= context.widowAge) {
        spouseSS = Math.max(context.primaryMonthlyBenefit, context.spouseMonthlyBenefit) * 12;
        primarySS = 0;
    }

    const yearsFromToday = context.yearsToRetirement + (yearIndex - 1);
    // nominalFactor is always applied (unlike inflationFactor below) since the
    // withdrawal simulation needs true nominal dollars regardless of display mode.
    const nominalFactor = Math.pow(1 + context.inflationRate, yearsFromToday);
    const inflationFactor = context.showTodaysDollars ? 1 : nominalFactor;

    return {
        year: yearIndex,
        primaryAge,
        spouseAge,
        hasSpouse: context.hasSpouse,
        isWidowed: context.hasSpouse && context.widowAge > 0 && spouseAge >= context.widowAge,
        primarySS: primarySS * inflationFactor,
        spouseSS: spouseSS * inflationFactor,
        total: (primarySS + spouseSS) * inflationFactor,
        totalNominal: (primarySS + spouseSS) * nominalFactor,
    };
}

// Employee-side FICA (Social Security + Medicare) withholding rate, applied to
// Other Income as if it were a normal W-2 job. Per user's explicit choice, the
// self-employment case (which would double this, since there's no employer to
// split it with) is ignored for simplicity.
const OTHER_INCOME_PAYROLL_TAX_RATE = 0.0765;

// Part-time/side-hustle income for each person, active only between their own
// [startAge, stopAge]. Like Social Security, this gets automatic COLA increases,
// so it's inflated up to nominal dollars when not showing today's dollars (rather
// than left flat like the Annuity).
function calculateOtherIncomeYear(yearIndex, context) {
    const primaryAge = context.retirementAge + (yearIndex - 1);
    const spouseAge = context.spouseAgeAtRetirement + (yearIndex - 1);

    let primaryOtherIncome = (primaryAge >= context.primaryOtherIncomeStartAge && primaryAge <= context.primaryOtherIncomeStopAge)
        ? context.primaryOtherIncomeAmount * 12
        : 0;
    const spouseOtherIncome = (context.hasSpouse &&
        spouseAge >= context.spouseOtherIncomeStartAge && spouseAge <= context.spouseOtherIncomeStopAge)
        ? context.spouseOtherIncomeAmount * 12
        : 0;

    // Primary is assumed deceased once the spouse reaches widow age; his own
    // income stops, the spouse's own income is unaffected. Only applicable when
    // there's actually a spouse to survive him.
    if (context.hasSpouse && context.widowAge > 0 && spouseAge >= context.widowAge) {
        primaryOtherIncome = 0;
    }

    const yearsFromToday = context.yearsToRetirement + (yearIndex - 1);
    // nominalFactor is always applied (unlike inflationFactor below) since the
    // withdrawal simulation needs true nominal dollars regardless of display mode.
    const nominalFactor = Math.pow(1 + context.inflationRate, yearsFromToday);
    const inflationFactor = context.showTodaysDollars ? 1 : nominalFactor;

    return {
        year: yearIndex,
        primaryAge,
        spouseAge,
        hasSpouse: context.hasSpouse,
        isWidowed: context.hasSpouse && context.widowAge > 0 && spouseAge >= context.widowAge,
        primaryOtherIncome: primaryOtherIncome * inflationFactor,
        spouseOtherIncome: spouseOtherIncome * inflationFactor,
        total: (primaryOtherIncome + spouseOtherIncome) * inflationFactor,
        totalNominal: (primaryOtherIncome + spouseOtherIncome) * nominalFactor,
    };
}

// Combines the Annuity, Social Security, Other Income, and Portfolio Withdrawal
// projection rows into a single Income table so users can see all income sources
// (and the total) in one place.
function renderIncomeProjectionTable(annuityRows, socialSecurityRows, otherIncomeRows, withdrawalRows) {
    const tbody = document.getElementById('income-projection-tbody');
    tbody.innerHTML = '';

    annuityRows.forEach((annuityRow, index) => {
        const ssRow = socialSecurityRows[index];
        const otherRow = otherIncomeRows[index];
        const withdrawalRow = withdrawalRows[index];
        const ageCell = formatAgeCell(annuityRow.primaryAge, annuityRow.spouseAge, annuityRow.hasSpouse, annuityRow.isWidowed);

        const annuityTotal = annuityRow.total;
        const ssTotal = ssRow.total;
        const otherTotal = otherRow.total;
        const portfolioWithdrawal = withdrawalRow.totalWithdrawal;
        const total = annuityTotal + ssTotal + otherTotal + portfolioWithdrawal;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${annuityRow.year}</td>
            <td>${ageCell}</td>
            <td>${formatResultCurrency(annuityTotal)}</td>
            <td>${formatResultCurrency(ssTotal)}</td>
            <td>${formatResultCurrency(otherTotal)}</td>
            <td>${formatResultCurrency(portfolioWithdrawal)}</td>
            <td class="total-cell">${formatResultCurrency(total)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// SECURE 2.0 requires traditional IRA/401(k) distributions to begin at age 73
// (current law through 2032; rises to 75 in 2033, which this simplified
// calculator doesn't model).
const DEFAULT_RMD_AGE = 73; // default if user does not set

// IRS Uniform Lifetime Table (Table III, Pub. 590-B) applicable denominators,
// used for owners whose spouse isn't both the sole beneficiary and more than 10
// years younger -- the common case this simplified calculator assumes.
const RMD_UNIFORM_LIFETIME_DIVISORS = {
    72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1,
    80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
    88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
    96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2,
    104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4,
    112: 3.3, 113: 3.1, 114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3,
};
const RMD_MAX_AGE_DIVISOR = 2.0; // Table bottoms out at age 120 and older.

function getRmdDivisor(age) {
    return RMD_UNIFORM_LIFETIME_DIVISORS[age] ?? RMD_MAX_AGE_DIVISOR;
}

// Each year, withdraws the shortfall between expenses and guaranteed income
// (annuity + Social Security) from the portfolio -- taxable first, then
// traditional (pre-tax), then Roth last, preserving tax-advantaged growth as
// long as possible. Then, if the caller supplied a tax gross-up amount (see
// computeYearRows), withdraws that too, continuing the same waterfall, and
// finally makes any requested Roth conversion (traditional -> Roth). Everything
// here runs in nominal dollars; the today's-dollars conversion (like the
// annuity's) is only applied to the returned display values. Any surplus
// (guaranteed income exceeding expenses) isn't reinvested -- it's simply left
// unmodeled as extra cash flow outside the portfolio.
function calculateWithdrawalYear(yearIndex, context, accounts) {
    const primaryAge = context.retirementAge + (yearIndex - 1);
    const spouseAge = context.spouseAgeAtRetirement + (yearIndex - 1);

    const shortfall = Math.max(0, context.expensesNominal - context.incomeNominal);

    // RMDs are based on the traditional balance at the end of the prior year (i.e.
    // its balance here, before this year's withdrawal) and the primary's age;
    // widow status is ignored for this calculation for simplicity.
    const traditionalBalanceBeforeWithdrawal = accounts.traditional.stock + accounts.traditional.bond;
    const rmdAmount = primaryAge >= context.rmdStartAge
        ? traditionalBalanceBeforeWithdrawal / getRmdDivisor(primaryAge)
        : 0;

    let remaining = shortfall;
    let taxableWithdrawal = withdrawFromAccount(accounts.taxable, remaining);
    remaining -= taxableWithdrawal;

    // What traditional would have needed to cover, absent any RMD forcing -- kept
    // separately so the table can display this instead of the RMD-inflated amount.
    const traditionalNeedBeforeRmd = remaining;

    // The traditional withdrawal must be bumped up to the RMD even if that's more
    // than needed to cover expenses; per user's choice, the excess (net of its own
    // estimated tax) is deposited into Roth below rather than left as unmodeled
    // surplus spending.
    let traditionalWithdrawal = withdrawFromAccount(accounts.traditional, Math.max(remaining, rmdAmount));
    // Real cash actually pulled for the pre-RMD need, capped by whatever the
    // account could provide (relevant if the balance ran out mid-withdrawal).
    let traditionalWithdrawalDisplay = Math.min(traditionalNeedBeforeRmd, traditionalWithdrawal);
    // Snapshot before gross-up (below) adds more to traditionalWithdrawal, so this
    // captures only the RMD-forced portion, already capped if the account ran dry.
    const rmdExcessWithdrawn = Math.max(0, traditionalWithdrawal - traditionalNeedBeforeRmd);
    remaining = Math.max(0, remaining - traditionalWithdrawal);

    let rothWithdrawal = withdrawFromAccount(accounts.roth, remaining);
    remaining -= rothWithdrawal;

    // Gross-up: the caller sizes this to (approximately) cover this year's own tax
    // bill, so it's withdrawn on top of the shortfall above, continuing the same
    // taxable -> traditional -> Roth waterfall (a Roth-funded gross-up needs no
    // further tax since Roth withdrawals aren't taxed).
    let taxGrossUpRemaining = Math.max(0, context.additionalWithdrawalForTaxes || 0);
    const grossUpFromTaxable = withdrawFromAccount(accounts.taxable, taxGrossUpRemaining);
    taxGrossUpRemaining -= grossUpFromTaxable;
    const grossUpFromTraditional = withdrawFromAccount(accounts.traditional, taxGrossUpRemaining);
    taxGrossUpRemaining -= grossUpFromTraditional;
    const grossUpFromRoth = withdrawFromAccount(accounts.roth, taxGrossUpRemaining);
    taxGrossUpRemaining -= grossUpFromRoth;

    taxableWithdrawal += grossUpFromTaxable;
    traditionalWithdrawal += grossUpFromTraditional;
    traditionalWithdrawalDisplay += grossUpFromTraditional;
    rothWithdrawal += grossUpFromRoth;
    const taxGrossUpWithdrawal = grossUpFromTaxable + grossUpFromTraditional + grossUpFromRoth;

    // RMD-excess-to-Roth: the cash already withdrawn above (rmdExcessWithdrawn) just
    // needs to land somewhere instead of vanishing as unmodeled surplus. The caller
    // (computeYearRows) already estimated and netted out this excess's own tax (and
    // netted out any of it consumed by the Gross-Up for Taxes feature) before handing
    // us the after-tax amount to deposit; scaled down here only if this real run's
    // account balance capped the withdrawal lower than the dry run that sized it.
    const rmdExcessRequested = Math.max(0, context.rmdExcessRequestedNominal || 0);
    const rmdExcessDeposit = rmdExcessRequested > 0
        ? (context.rmdExcessNetDeposit || 0) * (rmdExcessWithdrawn / rmdExcessRequested)
        : 0;
    depositToAccount(accounts.roth, rmdExcessDeposit);

    // Roth conversion: pulled from Traditional only (not the shortfall waterfall,
    // since a conversion is a deliberate account move, not spending). Only the
    // caller's pre-estimated after-tax amount lands in Roth -- the gap is the
    // conversion's own tax bill, "paid" by shrinking the deposit rather than a
    // further withdrawal. If the account runs dry mid-conversion, the deposit is
    // scaled down proportionally so it never nets out more than was converted.
    const rothConversionRequested = Math.max(0, context.rothConversionAmount || 0);
    const rothConversionWithdrawal = withdrawFromAccount(accounts.traditional, rothConversionRequested);
    const rothConversionDeposit = rothConversionRequested > 0
        ? (context.rothConversionNetDeposit || 0) * (rothConversionWithdrawal / rothConversionRequested)
        : 0;
    depositToAccount(accounts.roth, rothConversionDeposit);
    traditionalWithdrawal += rothConversionWithdrawal;
    traditionalWithdrawalDisplay += rothConversionWithdrawal;

    // Whatever remains after the withdrawal grows for the rest of the year, so the
    // ending balance reflects a full year of stock/bond returns on the reduced base.
    // In advanced mode, the stock return for this specific projection year is used;
    // bonds always use the single bond return %.
    const yearMonthlyStockReturn = context.yearlyMonthlyStockReturns[yearIndex - 1];
    growAccount(accounts.taxable, yearMonthlyStockReturn, context.monthlyBondReturn, 12);
    growAccount(accounts.traditional, yearMonthlyStockReturn, context.monthlyBondReturn, 12);
    growAccount(accounts.roth, yearMonthlyStockReturn, context.monthlyBondReturn, 12);

    const taxableBalance = accounts.taxable.stock + accounts.taxable.bond;
    const traditionalBalance = accounts.traditional.stock + accounts.traditional.bond;
    const rothBalance = accounts.roth.stock + accounts.roth.bond;

    const yearsFromToday = context.yearsToRetirement + (yearIndex - 1);
    const deflationFactor = context.showTodaysDollars
        ? 1 / Math.pow(1 + context.inflationRate, yearsFromToday)
        : 1;

    return {
        year: yearIndex,
        primaryAge,
        spouseAge,
        hasSpouse: context.hasSpouse,
        isWidowed: context.hasSpouse && context.widowAge > 0 && spouseAge >= context.widowAge,
        rmdAmount: rmdAmount * deflationFactor,
        // Flags years where the RMD forced the real traditional withdrawal (below)
        // above what's shown in the Traditional column, so the two aren't confused.
        rmdExceedsShortfall: rmdAmount > traditionalWithdrawalDisplay,
        taxableWithdrawal: taxableWithdrawal * deflationFactor,
        // Deliberately NOT the same as traditionalWithdrawalNominal below when the
        // RMD forces a bigger real withdrawal -- this shows what would have been
        // withdrawn for spending/gross-up/conversion alone, so it doesn't just
        // parrot the RMD figure back; Total/Balance/Tax still use the real amount.
        traditionalWithdrawal: traditionalWithdrawalDisplay * deflationFactor,
        rothWithdrawal: rothWithdrawal * deflationFactor,
        // Already included in the three withdrawal figures above; broken out here
        // just so it's visible how much of the withdrawal was for taxes vs. spending.
        taxGrossUpWithdrawal: taxGrossUpWithdrawal * deflationFactor,
        // Net amount that actually landed in Roth -- combines the deliberate Roth
        // Conversion feature and the RMD-excess-to-Roth deposit (both shown in the
        // same column, per user's choice, since both are traditional->Roth moves).
        // Already included in traditionalWithdrawal above (the gross amounts) and in
        // rothBalance below.
        rothConversionDeposit: (rothConversionDeposit + rmdExcessDeposit) * deflationFactor,
        totalWithdrawal: (taxableWithdrawal + traditionalWithdrawal + rothWithdrawal) * deflationFactor,
        taxableBalance: taxableBalance * deflationFactor,
        traditionalBalance: traditionalBalance * deflationFactor,
        rothBalance: rothBalance * deflationFactor,
        totalBalance: (taxableBalance + traditionalBalance + rothBalance) * deflationFactor,
        // Already nominal -- needed by the tax projection regardless of display mode.
        rmdAmountNominal: rmdAmount,
        // Gross (pre-tax) RMD-forced excess this run actually withdrew, capped by
        // whatever the traditional balance could provide -- read by computeYearRows'
        // dry run to size the RMD-excess-to-Roth deposit above.
        rmdExcessNominal: rmdExcessWithdrawn,
        taxableWithdrawalNominal: taxableWithdrawal,
        traditionalWithdrawalNominal: traditionalWithdrawal,
        // Includes Roth (untaxed) too -- needed for the tax projection's effective rate,
        // which measures total tax against all cash drawn from the portfolio.
        totalWithdrawalNominal: taxableWithdrawal + traditionalWithdrawal + rothWithdrawal,
    };
}

function renderWithdrawalProjectionTable(rows) {
    const tbody = document.getElementById('withdrawal-projection-tbody');
    tbody.innerHTML = '';

    rows.forEach((row) => {
        const ageCell = formatAgeCell(row.primaryAge, row.spouseAge, row.hasSpouse, row.isWidowed);
        // Up arrow calls out years where the RMD forced a withdrawal bigger than
        // expenses actually required (the excess is deposited into Roth, net of tax --
        // see the Roth Conversion column).
        const rmdCellClass = row.rmdExceedsShortfall ? ' class="rmd-excess-cell"' : '';
        const rmdArrow = row.rmdExceedsShortfall ? ' &uarr;' : '';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.year}</td>
            <td>${ageCell}</td>
            <td${rmdCellClass}>${formatResultCurrency(row.rmdAmount)}${rmdArrow}</td>
            <td>${formatResultCurrency(row.taxableWithdrawal)}</td>
            <td>${formatResultCurrency(row.traditionalWithdrawal)}</td>
            <td>${formatResultCurrency(row.rothWithdrawal)}</td>
            <td>${formatResultCurrency(row.taxGrossUpWithdrawal)}</td>
            <td>${formatResultCurrency(row.rothConversionDeposit)}</td>
            <td class="total-cell">${formatResultCurrency(row.totalWithdrawal)}</td>
            <td>${formatResultCurrency(row.taxableBalance)}</td>
            <td>${formatResultCurrency(row.traditionalBalance)}</td>
            <td>${formatResultCurrency(row.rothBalance)}</td>
            <td class="total-cell">${formatResultCurrency(row.totalBalance)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Reads a filing status's 7 federal brackets as {rate, incomeOver} pairs.
function readBracketInputs(idPrefix, suffixes) {
    return suffixes.map((suffix) => ({
        rate: parsePercentInput(document.getElementById(`${idPrefix}-rate-${suffix}`)) / 100,
        incomeOver: parseCurrencyInput(document.getElementById(`${idPrefix}-income-${suffix}`)),
    }));
}

// Applies a standard marginal-bracket ladder: each bracket's rate only applies to
// the slice of income between its own threshold and the next bracket's.
function calculateProgressiveTax(taxableIncome, brackets) {
    let tax = 0;
    for (let i = 0; i < brackets.length; i++) {
        const lower = brackets[i].incomeOver;
        if (taxableIncome <= lower) {
            break;
        }
        const upper = i + 1 < brackets.length ? brackets[i + 1].incomeOver : Infinity;
        tax += (Math.min(taxableIncome, upper) - lower) * brackets[i].rate;
    }
    return tax;
}

// Long-term capital gains stack on top of ordinary taxable income (per the IRS
// Qualified Dividends and Capital Gain Tax Worksheet): each LTCG bracket's rate
// applies only to the slice of the combined ordinary+LTCG scale that both (a)
// falls within that bracket and (b) is above whatever ordinary income already
// occupies the bottom of the scale.
function calculateStackedLtcgTax(ordinaryTaxable, ltcgTaxable, brackets) {
    let tax = 0;
    const combinedTop = ordinaryTaxable + ltcgTaxable;
    for (let i = 0; i < brackets.length; i++) {
        const lower = brackets[i].incomeOver;
        const upper = i + 1 < brackets.length ? brackets[i + 1].incomeOver : Infinity;
        const amountInBracket = Math.max(0, Math.min(combinedTop, upper) - Math.max(ordinaryTaxable, lower));
        tax += amountInBracket * brackets[i].rate;
    }
    return tax;
}

// Social Security taxability thresholds are fixed by statute and have never been
// inflation-indexed (unlike the income tax brackets), so they're hardcoded here
// rather than editable in the tax tables dialog.
const SOCIAL_SECURITY_TAXABILITY_THRESHOLDS = {
    single: { lower: 25000, upper: 34000 },
    mfj: { lower: 32000, upper: 44000 },
};

// Implements the IRS "provisional income" formula: up to 50% of benefits become
// taxable once combined income (other income + half of SS) passes the lower
// threshold, and up to 85% once it passes the upper threshold.
function calculateTaxableSocialSecurity(otherIncome, ssBenefit, filingStatus) {
    if (ssBenefit <= 0) {
        return 0;
    }

    const { lower, upper } = SOCIAL_SECURITY_TAXABILITY_THRESHOLDS[filingStatus];
    const provisionalIncome = otherIncome + ssBenefit * 0.5;

    if (provisionalIncome <= lower) {
        return 0;
    }
    if (provisionalIncome <= upper) {
        return Math.min(ssBenefit * 0.5, (provisionalIncome - lower) * 0.5);
    }

    const taxableUpToLowerTier = Math.min(ssBenefit * 0.5, (upper - lower) * 0.5);
    return Math.min(ssBenefit * 0.85, taxableUpToLowerTier + (provisionalIncome - upper) * 0.85);
}

// Net Investment Income Tax (IRC 1411): 3.8% of the lesser of net investment
// income or the excess of MAGI over the threshold. These thresholds are fixed by
// statute and have never been inflation-indexed, unlike the income tax brackets.
const NIIT_RATE = 0.038;
const NIIT_MAGI_THRESHOLDS = { single: 200000, mfj: 250000 };

// Finds the marginal rate that would apply to the next dollar of income at the
// given level, using the same bracket ladder as calculateProgressiveTax /
// calculateStackedLtcgTax (ascending by incomeOver).
function findMarginalRate(income, brackets) {
    let rate = brackets[0].rate;
    for (const bracket of brackets) {
        if (income >= bracket.incomeOver) {
            rate = bracket.rate;
        }
    }
    return rate;
}

// One-shot estimate of the combined marginal rate (federal + state + NIIT) on the
// next withdrawal dollar, based on which account it would come from -- used to
// size the withdrawal gross-up in computeYearRows without an iterative solve.
// Deliberately ignores secondary effects like a dollar pushing more Social
// Security into taxability (the "torpedo" zone), which would otherwise require
// re-solving the whole tax calculation for each candidate gross-up amount.
function estimateWithdrawalMarginalRate(source, taxResult, stateTaxRate, taxableBasisFraction) {
    if (source === 'roth') {
        return 0; // Roth withdrawals are never taxed.
    }
    if (source === 'traditional') {
        return findMarginalRate(taxResult.ordinaryTaxable, taxResult.federalBrackets) + stateTaxRate;
    }
    // source === 'taxable': only the non-basis fraction is taxed, as LTCG stacked
    // on top of ordinary income; NIIT applies once MAGI is already past threshold.
    const combinedTop = taxResult.ordinaryTaxable + taxResult.ltcgTaxable;
    const ltcgRate = findMarginalRate(combinedTop, taxResult.ltcgBrackets);
    const niitRate = taxResult.magiNominal > NIIT_MAGI_THRESHOLDS[taxResult.filingStatusRaw] ? NIIT_RATE : 0;
    return (1 - taxableBasisFraction) * (ltcgRate + niitRate + stateTaxRate);
}

// 2026 Medicare Part B and Part D IRMAA tiers (CMS fact sheet): the surcharges
// added on top of the beneficiary's premiums once MAGI exceeds each threshold.
// Both parts share the same MAGI breakpoints. The Part D surcharge is a flat
// add-on collected the same way regardless of which plan (and base premium) a
// beneficiary has, so it's included even though this app doesn't model a base
// Part D premium (it varies too widely by plan).
const IRMAA_PART_B_TIERS = [
    { singleMagiOver: 0, mfjMagiOver: 0, partBSurcharge: 0, partDSurcharge: 0 },
    { singleMagiOver: 109000, mfjMagiOver: 218000, partBSurcharge: 81.20, partDSurcharge: 14.50 },
    { singleMagiOver: 137000, mfjMagiOver: 274000, partBSurcharge: 202.90, partDSurcharge: 37.50 },
    { singleMagiOver: 171000, mfjMagiOver: 342000, partBSurcharge: 324.60, partDSurcharge: 60.40 },
    { singleMagiOver: 205000, mfjMagiOver: 410000, partBSurcharge: 446.30, partDSurcharge: 83.30 },
    { singleMagiOver: 500000, mfjMagiOver: 750000, partBSurcharge: 487.00, partDSurcharge: 91.00 },
];

// IRMAA is assessed using MAGI from 2 tax years prior, which conveniently avoids
// any circularity with the current year's own withdrawals/expenses (unlike, say,
// grossing up a withdrawal to cover its own resulting tax bill would).
const IRMAA_LOOKBACK_YEARS = 2;

// Thresholds and surcharge dollar amounts are inflated to the premium year's
// nominal dollars (nominalFactor), the same convention used for tax brackets;
// magi is assumed already expressed in that same year's nominal terms. Returns
// the combined Part B + Part D surcharge, since both are billed the same way.
function getIrmaaMonthlySurcharge(magi, filingStatus, nominalFactor) {
    let surcharge = 0;
    for (const tier of IRMAA_PART_B_TIERS) {
        const threshold = (filingStatus === 'mfj' ? tier.mfjMagiOver : tier.singleMagiOver) * nominalFactor;
        if (magi > threshold) {
            surcharge = (tier.partBSurcharge + tier.partDSurcharge) * nominalFactor;
        }
    }
    return surcharge;
}

// Calculates one projection year's federal and state tax liability. Traditional
// withdrawals and annuity income are ordinary income; the taxable (non-basis)
// portion of taxable-account withdrawals is long-term capital gains; Roth
// withdrawals are untaxed and don't appear here at all. Filing status is Single
// the whole projection when there's no spouse, or switches from MFJ to Single
// once the primary is presumed deceased (spouse past widow age).
function calculateTaxYear(yearIndex, context) {
    const primaryAge = context.retirementAge + (yearIndex - 1);
    const spouseAge = context.spouseAgeAtRetirement + (yearIndex - 1);

    const isWidowed = context.hasSpouse && context.widowAge > 0 && spouseAge >= context.widowAge;
    const filingStatus = (!context.hasSpouse || isWidowed) ? 'single' : 'mfj';

    const yearsFromToday = context.yearsToRetirement + (yearIndex - 1);
    // Bracket thresholds and the standard deduction are inflated each year, the
    // same way the IRS actually adjusts them, so future tax burdens stay realistic
    // instead of pushing everyone into the top bracket after enough inflation.
    const nominalFactor = Math.pow(1 + context.inflationRate, yearsFromToday);
    const inflateBracket = (bracket) => ({ rate: bracket.rate, incomeOver: bracket.incomeOver * nominalFactor });

    const federalBrackets = (filingStatus === 'mfj' ? context.federalBracketsMfj : context.federalBracketsSingle)
        .map(inflateBracket);
    const ltcgBrackets = (filingStatus === 'mfj' ? context.ltcgBracketsMfj : context.ltcgBracketsSingle)
        .map(inflateBracket);

    let seniorDeduction = 0;
    if (filingStatus === 'mfj') {
        seniorDeduction += (primaryAge >= 65 ? context.seniorDeductionMfj : 0) +
            (spouseAge >= 65 ? context.seniorDeductionMfj : 0);
    } else if (filingStatus === 'single') {
        // For Single filers (including widowed spouses), check the primary's age
        // unless the spouse has reached widow age, in which case check spouse's age.
        seniorDeduction += (isWidowed ? spouseAge : primaryAge) >= 65
            ? context.seniorDeductionSingle
            : 0;
    }
    const standardDeduction =
        ((filingStatus === 'mfj' ? context.standardDeductionMfj : context.standardDeductionSingle) + seniorDeduction) *
        nominalFactor;

    const ordinaryIncomeBeforeSS = context.traditionalWithdrawalNominal + context.annuityNominal + context.otherIncomeNominal;
    const ltcgIncome = context.taxableWithdrawalNominal * (1 - context.taxableBasisFraction);

    const taxableSocialSecurity = calculateTaxableSocialSecurity(
        ordinaryIncomeBeforeSS + ltcgIncome, context.socialSecurityNominal, filingStatus
    );
    const ordinaryIncome = ordinaryIncomeBeforeSS + taxableSocialSecurity;

    // Deduction reduces ordinary income first; any leftover spills onto LTCG (this
    // matches the IRS worksheet's arithmetic even though it's not written that way).
    const ordinaryTaxable = Math.max(0, ordinaryIncome - standardDeduction);
    const totalTaxable = Math.max(0, ordinaryIncome + ltcgIncome - standardDeduction);
    const ltcgTaxable = totalTaxable - ordinaryTaxable;

    const federalIncomeTax = calculateProgressiveTax(ordinaryTaxable, federalBrackets) +
        calculateStackedLtcgTax(ordinaryTaxable, ltcgTaxable, ltcgBrackets);

    // NIIT applies to gross income (MAGI), not the post-deduction taxable amount.
    const magiNominal = ordinaryIncome + ltcgIncome;
    const netInvestmentIncome = ltcgIncome;
    const niit = NIIT_RATE * Math.min(netInvestmentIncome, Math.max(0, magiNominal - NIIT_MAGI_THRESHOLDS[filingStatus]));

    // Flat-rate state tax: no preferential capital gains rate and no state standard
    // deduction are modeled, since the tax tables dialog only exposes a flat rate.
    const stateTaxableIncome = ordinaryIncomeBeforeSS + ltcgIncome +
        (context.stateTaxesSocialSecurity ? taxableSocialSecurity : 0);
    const stateTax = stateTaxableIncome * context.stateTaxRate;

    // Employee-side FICA withholding on Other Income, treated like a normal W-2
    // job (self-employment's doubled rate is ignored, per user's explicit choice).
    // Not part of federal/state income tax -- it's a separate payroll tax on gross
    // wages, so it's added on top rather than folded into ordinaryIncomeBeforeSS's
    // income-tax treatment above.
    const payrollTax = context.otherIncomeNominal * OTHER_INCOME_PAYROLL_TAX_RATE;

    const totalTax = federalIncomeTax + payrollTax + niit + stateTax;
    const deflationFactor = context.showTodaysDollars ? 1 / nominalFactor : 1;

    // Marginal rate the next dollar of ordinary income would face (federal only,
    // ignoring state/NIIT); effective rate is total tax against all cash actually
    // received this year -- annuity, all Social Security, Other Income, and every
    // withdrawal source including untaxed Roth -- both computed in nominal terms so
    // the ratio is unaffected by the today's-dollars display toggle.
    const marginalFederalRate = findMarginalRate(ordinaryTaxable, federalBrackets);
    const totalIncomeNominal = context.annuityNominal + context.socialSecurityNominal + context.otherIncomeNominal +
        context.totalWithdrawalNominal;
    const effectiveTaxRate = totalIncomeNominal > 0 ? totalTax / totalIncomeNominal : 0;

    return {
        year: yearIndex,
        primaryAge,
        spouseAge,
        hasSpouse: context.hasSpouse,
        isWidowed,
        filingStatus: filingStatus === 'mfj' ? 'MFJ' : 'Single',
        // Raw (lowercase) values, plus the nominal MAGI, feed the IRMAA lookback
        // 2 years later -- keep these nominal/unconverted regardless of display mode.
        filingStatusRaw: filingStatus,
        magiNominal,
        // Internal-use fields (not displayed) that the withdrawal gross-up's
        // one-shot marginal-rate estimate needs -- see estimateWithdrawalMarginalRate.
        ordinaryTaxable,
        ltcgTaxable,
        federalBrackets,
        ltcgBrackets,
        ordinaryIncome: ordinaryIncome * deflationFactor,
        ltcgIncome: ltcgIncome * deflationFactor,
        taxableSocialSecurity: taxableSocialSecurity * deflationFactor,
        standardDeduction: standardDeduction * deflationFactor,
        federalIncomeTax: federalIncomeTax * deflationFactor,
        payrollTax: payrollTax * deflationFactor,
        niit: niit * deflationFactor,
        stateTax: stateTax * deflationFactor,
        totalTax: totalTax * deflationFactor,
        marginalFederalRate,
        effectiveTaxRate,
        // Deflated to match totalTax above, so the two can be summed across years
        // for a dollar-weighted running average rate (totalTax / totalIncome).
        totalIncome: totalIncomeNominal * deflationFactor,
        // Already nominal -- needed by the withdrawal gross-up regardless of display mode.
        totalTaxNominal: totalTax,
    };
}

function renderTaxProjectionTable(rows) {
    const tbody = document.getElementById('tax-projection-tbody');
    tbody.innerHTML = '';

    // Running total uses the same (possibly today's-dollars-deflated) totalTax
    // figures shown per row, so it matches what a reader would get adding the
    // Total column by hand; the running rate is dollar-weighted (running total
    // tax / running total income), not a plain mean of each year's own rate --
    // that avoids a low-income year with a single large event (e.g. a Roth
    // conversion) skewing the average out of proportion to the dollars involved.
    let runningTotalTax = 0;
    let runningTotalIncome = 0;

    rows.forEach((row, index) => {
        const ageCell = formatAgeCell(row.primaryAge, row.spouseAge, row.hasSpouse, row.isWidowed);
        runningTotalTax += row.totalTax;
        runningTotalIncome += row.totalIncome;
        const runningAvgRate = runningTotalIncome > 0 ? runningTotalTax / runningTotalIncome : 0;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.year}</td>
            <td>${ageCell}</td>
            <td>${row.filingStatus}</td>
            <td>${formatResultCurrency(row.ordinaryIncome)}</td>
            <td>${formatResultCurrency(row.ltcgIncome)}</td>
            <td>${formatResultCurrency(row.taxableSocialSecurity)}</td>
            <td>${formatResultCurrency(row.standardDeduction)}</td>
            <td>${formatResultCurrency(row.federalIncomeTax)}</td>
            <td>${formatResultCurrency(row.payrollTax)}</td>
            <td>${formatResultCurrency(row.niit)}</td>
            <td>${formatResultCurrency(row.stateTax)}</td>
            <td class="total-cell">${formatResultCurrency(row.totalTax)}</td>
            <td>${formatResultPercent(row.marginalFederalRate)} / ${formatResultPercent(row.effectiveTaxRate)}</td>
            <td>${formatResultCurrency(runningTotalTax)} / ${formatResultPercent(runningAvgRate)}</td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById('calculate-btn').addEventListener('click', () => {
    const retirementAge = parseFloat(document.getElementById('retirement-age').value) || 0;
    const primaryCurrentAge = parseFloat(document.getElementById('primary-current-age').value) || 0;
    const yearsToRetirement = Math.max(0, retirementAge - primaryCurrentAge);
    const monthsToRetirement = yearsToRetirement * 12;

    const stockFraction = parsePercentInput(document.getElementById('stock-percentage')) / 100;
    const bondFraction = 1 - stockFraction;
    const monthlyStockReturn = parsePercentInput(document.getElementById('stock-return-percentage')) / 100 / 12;
    const monthlyBondReturn = parsePercentInput(document.getElementById('bond-return-percentage')) / 100 / 12;

    const useAdvancedStockReturns = document.getElementById('use-advanced-stock-returns').checked;

    const traditionalAccount = projectAccountBalance(
        parseCurrencyInput(document.getElementById('traditional-retirement-balance')),
        parseCurrencyInput(document.getElementById('traditional-monthly-contribution')),
        stockFraction, bondFraction, monthlyStockReturn, monthlyBondReturn, monthsToRetirement
    );
    const rothAccount = projectAccountBalance(
        parseCurrencyInput(document.getElementById('roth-retirement-balance')),
        parseCurrencyInput(document.getElementById('roth-monthly-contribution')),
        stockFraction, bondFraction, monthlyStockReturn, monthlyBondReturn, monthsToRetirement
    );
    const taxableAccount = projectAccountBalance(
        parseCurrencyInput(document.getElementById('taxable-balance')),
        parseCurrencyInput(document.getElementById('taxable-monthly-contribution')),
        stockFraction, bondFraction, monthlyStockReturn, monthlyBondReturn, monthsToRetirement
    );
    const traditionalBalance = traditionalAccount.stock + traditionalAccount.bond;
    const rothBalance = rothAccount.stock + rothAccount.bond;
    const taxableBalance = taxableAccount.stock + taxableAccount.bond;

    // "Today's Dollars" discounts the nominal future balances back to present-day
    // purchasing power using the inflation rate over the years until retirement.
    let deflationFactor = 1;
    if (document.getElementById('todays-dollars').checked) {
        const inflationRate = parsePercentInput(document.getElementById('inflation-percentage')) / 100;
        deflationFactor = 1 / Math.pow(1 + inflationRate, yearsToRetirement);
    }

    const traditionalResult = traditionalBalance * deflationFactor;
    const rothResult = rothBalance * deflationFactor;
    const taxableResult = taxableBalance * deflationFactor;

    document.getElementById('result-traditional-balance').textContent = formatResultCurrency(traditionalResult);
    document.getElementById('result-roth-balance').textContent = formatResultCurrency(rothResult);
    document.getElementById('result-taxable-balance').textContent = formatResultCurrency(taxableResult);
    document.getElementById('result-total-balance').textContent =
        formatResultCurrency(traditionalResult + rothResult + taxableResult);

    const projectionYears = parseFloat(document.getElementById('projection-years').value) || 0;
    const spouseCurrentAge = parseFloat(document.getElementById('spouse-current-age').value) || 0;

    const expenseContext = {
        retirementAge,
        yearsToRetirement,
        spouseAgeAtRetirement: spouseCurrentAge + yearsToRetirement,
        showTodaysDollars: document.getElementById('todays-dollars').checked,
        inflationRate: parsePercentInput(document.getElementById('inflation-percentage')) / 100,
        hasSpouse: document.getElementById('has-spouse').checked,
        widowAge: parseFloat(document.getElementById('widow-age').value) || 0,
        rmdStartAge: parseInt(document.getElementById('rmd-start-age').value) || DEFAULT_RMD_AGE,
        monthlyExpenses: parseCurrencyInput(document.getElementById('monthly-expenses')),
        primaryPreMedicareExpenses: parseCurrencyInput(document.getElementById('pre-medicare-expenses-primary')),
        spousePreMedicareExpenses: parseCurrencyInput(document.getElementById('pre-medicare-expenses-spouse')),
        medicarePartBPremium: parseCurrencyInput(document.getElementById('medicare-part-b-premium')),
        annuitizedExpenses: {
            mortgage: {
                amount: parseCurrencyInput(document.getElementById('annuitized-mortgage-amount')),
                endAge: parseFloat(document.getElementById('annuitized-mortgage-end-age').value) || 0,
            },
            primaryAuto: {
                amount: parseCurrencyInput(document.getElementById('annuitized-primary-auto-amount')),
                endAge: parseFloat(document.getElementById('annuitized-primary-auto-end-age').value) || 0,
            },
            spouseAuto: {
                amount: parseCurrencyInput(document.getElementById('annuitized-spouse-auto-amount')),
                endAge: parseFloat(document.getElementById('annuitized-spouse-auto-end-age').value) || 0,
            },
        },
        temporaryExpenses: readExpenseRows('temporary-expenses-list', (num) => ({
            startAge: parseFloat(document.getElementById(`temporary-expense-${num}-start-age`).value) || 0,
            endAge: parseFloat(document.getElementById(`temporary-expense-${num}-end-age`).value) || 0,
            amount: parseCurrencyInput(document.getElementById(`temporary-expense-${num}-amount`)),
        })),
        oneTimeExpenses: readExpenseRows('one-time-expenses-list', (num) => ({
            age: parseFloat(document.getElementById(`one-time-expense-${num}-age`).value) || 0,
            amount: parseCurrencyInput(document.getElementById(`one-time-expense-${num}-amount`)),
        })),
    };

    const annuityContext = {
        retirementAge,
        yearsToRetirement,
        spouseAgeAtRetirement: expenseContext.spouseAgeAtRetirement,
        showTodaysDollars: expenseContext.showTodaysDollars,
        inflationRate: expenseContext.inflationRate,
        hasSpouse: expenseContext.hasSpouse,
        widowAge: expenseContext.widowAge,
        primaryAnnuityAge: parseFloat(document.getElementById('primary-annuity-age').value) || 0,
        spouseAnnuityAge: parseFloat(document.getElementById('spouse-annuity-age').value) || 0,
        primaryAnnuityIncome: parseCurrencyInput(document.getElementById('annuity-primary-income')),
        spouseAnnuityIncome: parseCurrencyInput(document.getElementById('annuity-secondary-income')),
    };

    const annuityRows = [];
    for (let year = 1; year <= projectionYears; year++) {
        annuityRows.push(calculateAnnuityYear(year, annuityContext));
    }

    const primarySocialSecurityAge = parseFloat(document.getElementById('primary-social-security-age').value) || 0;
    const spouseSocialSecurityAge = parseFloat(document.getElementById('spouse-social-security-age').value) || 0;
    const primaryBenefitAtFRA = parseCurrencyInput(document.getElementById('social-security-primary-benefit'));
    const spouseBenefitAtFRA = parseCurrencyInput(document.getElementById('social-security-secondary-benefit'));

    const socialSecurityContext = {
        retirementAge,
        yearsToRetirement,
        spouseAgeAtRetirement: expenseContext.spouseAgeAtRetirement,
        showTodaysDollars: expenseContext.showTodaysDollars,
        inflationRate: expenseContext.inflationRate,
        hasSpouse: annuityContext.hasSpouse,
        widowAge: annuityContext.widowAge,
        primaryClaimAge: primarySocialSecurityAge,
        spouseClaimAge: spouseSocialSecurityAge,
        primaryMonthlyBenefit: calculateSocialSecurityMonthlyBenefit(primaryBenefitAtFRA, primarySocialSecurityAge),
        spouseMonthlyBenefit: calculateSocialSecurityMonthlyBenefit(spouseBenefitAtFRA, spouseSocialSecurityAge),
    };

    const socialSecurityRows = [];
    for (let year = 1; year <= projectionYears; year++) {
        socialSecurityRows.push(calculateSocialSecurityYear(year, socialSecurityContext));
    }

    const otherIncomeContext = {
        retirementAge,
        yearsToRetirement,
        spouseAgeAtRetirement: expenseContext.spouseAgeAtRetirement,
        showTodaysDollars: expenseContext.showTodaysDollars,
        inflationRate: expenseContext.inflationRate,
        hasSpouse: expenseContext.hasSpouse,
        widowAge: expenseContext.widowAge,
        primaryOtherIncomeStartAge: parseFloat(document.getElementById('primary-other-income-start-age').value) || 0,
        primaryOtherIncomeStopAge: parseFloat(document.getElementById('primary-other-income-stop-age').value) || 0,
        spouseOtherIncomeStartAge: parseFloat(document.getElementById('spouse-other-income-start-age').value) || 0,
        spouseOtherIncomeStopAge: parseFloat(document.getElementById('spouse-other-income-stop-age').value) || 0,
        primaryOtherIncomeAmount: parseCurrencyInput(document.getElementById('other-income-primary-amount')),
        spouseOtherIncomeAmount: parseCurrencyInput(document.getElementById('other-income-secondary-amount')),
    };

    const otherIncomeRows = [];
    for (let year = 1; year <= projectionYears; year++) {
        otherIncomeRows.push(calculateOtherIncomeYear(year, otherIncomeContext));
    }

    // Start from the actual retirement-age stock/bond split (which may have drifted
    // from stockFraction/bondFraction) rather than the plain traditional/roth/taxable
    // totals, so withdrawals and post-withdrawal growth apply to the real mix.
    const startingAccounts = {
        taxable: { stock: taxableAccount.stock, bond: taxableAccount.bond },
        traditional: { stock: traditionalAccount.stock, bond: traditionalAccount.bond },
        roth: { stock: rothAccount.stock, bond: rothAccount.bond },
    };

    // Build a per-projection-year monthly stock return array. In advanced mode,
    // read the modal inputs (falling back to the default stock return % if an
    // input is missing). Otherwise, every projection year uses the default.
    const defaultAnnualStockReturn = parsePercentInput(document.getElementById('stock-return-percentage')) / 100;
    const yearlyMonthlyStockReturns = new Array(Math.max(0, projectionYears)).fill(monthlyStockReturn);
    if (useAdvancedStockReturns) {
        for (let i = 0; i < projectionYears; i++) {
            const input = document.getElementById(`advanced-stock-return-year-${i + 1}`);
            const annualReturn = input ? parsePercentInput(input) / 100 : defaultAnnualStockReturn;
            yearlyMonthlyStockReturns[i] = annualReturn / 12;
        }
    }

    const withdrawalContextBase = {
        retirementAge,
        yearsToRetirement,
        spouseAgeAtRetirement: expenseContext.spouseAgeAtRetirement,
        showTodaysDollars: expenseContext.showTodaysDollars,
        inflationRate: expenseContext.inflationRate,
        hasSpouse: expenseContext.hasSpouse,
        widowAge: expenseContext.widowAge,
        rmdStartAge: expenseContext.rmdStartAge, // added
        yearlyMonthlyStockReturns,
        monthlyBondReturn,
    };

    // Tax table settings are read once here rather than per-year, since they don't
    // change across the projection (only the bracket/deduction dollar amounts get
    // inflated year-by-year, inside calculateTaxYear itself).
    const taxContextBase = {
        retirementAge,
        yearsToRetirement,
        spouseAgeAtRetirement: expenseContext.spouseAgeAtRetirement,
        showTodaysDollars: expenseContext.showTodaysDollars,
        inflationRate: expenseContext.inflationRate,
        hasSpouse: expenseContext.hasSpouse,
        widowAge: expenseContext.widowAge,
        taxableBasisFraction: parsePercentInput(document.getElementById('taxable-basis-percentage')) / 100,
        federalBracketsSingle: readBracketInputs('federal-bracket-single', [1, 2, 3, 4, 5, 6, 7]),
        federalBracketsMfj: readBracketInputs('federal-bracket-mfj', [1, 2, 3, 4, 5, 6, 7]),
        ltcgBracketsSingle: [
            { rate: 0, incomeOver: parseCurrencyInput(document.getElementById('ltcg-bracket-single-0')) },
            { rate: 0.15, incomeOver: parseCurrencyInput(document.getElementById('ltcg-bracket-single-15')) },
            { rate: 0.20, incomeOver: parseCurrencyInput(document.getElementById('ltcg-bracket-single-20')) },
        ],
        ltcgBracketsMfj: [
            { rate: 0, incomeOver: parseCurrencyInput(document.getElementById('ltcg-bracket-mfj-0')) },
            { rate: 0.15, incomeOver: parseCurrencyInput(document.getElementById('ltcg-bracket-mfj-15')) },
            { rate: 0.20, incomeOver: parseCurrencyInput(document.getElementById('ltcg-bracket-mfj-20')) },
        ],
        standardDeductionSingle: parseCurrencyInput(document.getElementById('standard-deduction-single')),
        standardDeductionMfj: parseCurrencyInput(document.getElementById('standard-deduction-mfj')),
        seniorDeductionSingle: parseCurrencyInput(document.getElementById('senior-deduction-single')),
        seniorDeductionMfj: parseCurrencyInput(document.getElementById('senior-deduction-mfj')),
        stateTaxRate: parsePercentInput(document.getElementById('state-tax-rate')) / 100,
        stateTaxesSocialSecurity: document.getElementById('state-taxes-social-security').checked,
    };

    // Whether to withdraw extra each year to cover that year's own tax bill. When
    // off, behavior is unchanged from before this feature existed (taxes are simply
    // reported, not funded by additional withdrawals).
    const grossUpForTaxes = document.getElementById('gross-up-for-taxes').checked;

    // Roth conversion settings: a flat annual traditional-to-Roth conversion made
    // every year the primary's age falls within [start, end]. Zero amount disables
    // the feature entirely (same behavior as before it existed).
    const rothConversionStartAge = parseFloat(document.getElementById('roth-conversion-start-age').value) || 0;
    const rothConversionEndAge = parseFloat(document.getElementById('roth-conversion-end-age').value) || 0;
    const rothConversionAmount = parseCurrencyInput(document.getElementById('roth-conversion-amount'));

    // A balance difference this small is treated as "no room left" in an account,
    // avoiding floating-point noise from repeatedly picking that account as the
    // gross-up source for a fraction of a cent.
    const GROSS_UP_EPSILON = 0.01;

    // Computes a full expense -> withdrawal -> tax pass for a given year-by-year set
    // of IRMAA Medicare surcharges. Run twice: first with no IRMAA (just to learn
    // each year's income for the lookback below), then again with the real
    // surcharges applied, so the rendered results reflect them.
    function computeYearRows(irmaaMonthlySurchargeByYear) {
        const yearExpenseContext = { ...expenseContext, irmaaMonthlySurchargeByYear };
        const expenseRows = [];
        for (let year = 1; year <= projectionYears; year++) {
            expenseRows.push(calculateExpenseYear(year, yearExpenseContext));
        }

        // Clone starting balances so this pass's simulated withdrawals don't leak into
        // the other pass (withdrawFromAccount/growAccount mutate their account in place).
        const withdrawalAccounts = {
            taxable: { ...startingAccounts.taxable },
            traditional: { ...startingAccounts.traditional },
            roth: { ...startingAccounts.roth },
        };

        const buildTaxContext = (withdrawalRow, annuityNominal, socialSecurityNominal, otherIncomeNominal) => ({
            ...taxContextBase,
            traditionalWithdrawalNominal: withdrawalRow.traditionalWithdrawalNominal,
            taxableWithdrawalNominal: withdrawalRow.taxableWithdrawalNominal,
            totalWithdrawalNominal: withdrawalRow.totalWithdrawalNominal,
            annuityNominal,
            socialSecurityNominal,
            otherIncomeNominal,
        });

        const withdrawalRows = [];
        const taxRows = [];
        for (let year = 1; year <= projectionYears; year++) {
            const expensesNominal = expenseRows[year - 1].totalNominal;
            const annuityNominal = annuityRows[year - 1].totalNominal;
            const socialSecurityNominal = socialSecurityRows[year - 1].totalNominal;
            const otherIncomeNominal = otherIncomeRows[year - 1].totalNominal;
            const incomeNominal = annuityNominal + socialSecurityNominal + otherIncomeNominal;
            const yearWithdrawalContext = { ...withdrawalContextBase, expensesNominal, incomeNominal };

            // Dry run against a throwaway clone to learn the base (pre-gross-up,
            // pre-conversion) withdrawal composition and its resulting tax, without
            // touching the real account balances -- those are only mutated once,
            // below, by the real (final) withdrawal for the year. Needed regardless
            // of whether gross-up is on, since the Roth conversion's one-shot
            // marginal-rate estimate (below) also reads from it.
            const dryRunAccounts = {
                taxable: { ...withdrawalAccounts.taxable },
                traditional: { ...withdrawalAccounts.traditional },
                roth: { ...withdrawalAccounts.roth },
            };
            const baseWithdrawal = calculateWithdrawalYear(year, yearWithdrawalContext, dryRunAccounts);
            const baseTaxRow = calculateTaxYear(
                year, buildTaxContext(baseWithdrawal, annuityNominal, socialSecurityNominal, otherIncomeNominal)
            );

            // Roth conversion: same one-shot marginal-rate estimate the gross-up
            // uses (based on the pre-conversion base tax result), sized against the
            // full requested conversion rather than a single dollar -- an accepted
            // approximation, same as the gross-up's.
            const primaryAge = retirementAge + (year - 1);
            const rothConversionForYear =
                (rothConversionAmount > 0 && primaryAge >= rothConversionStartAge && primaryAge <= rothConversionEndAge)
                    ? rothConversionAmount
                    : 0;
            let rothConversionNetDeposit = 0;
            if (rothConversionForYear > 0) {
                const conversionMarginalRate = Math.min(0.9, estimateWithdrawalMarginalRate(
                    'traditional', baseTaxRow, taxContextBase.stateTaxRate, taxContextBase.taxableBasisFraction
                ));
                rothConversionNetDeposit = rothConversionForYear * (1 - conversionMarginalRate);
            }

            // RMD-excess-to-Roth: cash the RMD forced out of Traditional beyond what
            // expenses needed. The full gross excess is available (the actual tax on
            // it is already computed by calculateTaxYear below). It first covers any
            // tax bill not already covered by income surplus; only the remainder is
            // deposited to Roth. Previously this netted the excess against a one-shot
            // marginal-rate estimate, but that double-counted tax because the tax
            // table already includes the full RMD.
            const rmdExcessNet = baseWithdrawal.rmdExcessNominal;
            // If Gross-Up for Taxes is also on, this net cash is fungible with the other
            // surplus used to cover the tax bill (per user's choice) -- only reduced by
            // the gross-up branch below, never increased; whatever's left afterward is
            // what actually gets deposited to Roth.
            let rmdExcessUsedForTax = 0;

            let additionalWithdrawalForTaxes = 0;

            if (grossUpForTaxes) {
                // "Surplus" cash not needed for spending -- guaranteed income beyond
                // expenses -- is assumed to go toward taxes first, before the RMD-excess
                // net cash, before any extra withdrawal is needed.
                const incomeSurplus = Math.max(0, incomeNominal - expensesNominal);
                const taxShortfallAfterIncomeSurplus = Math.max(0, baseTaxRow.totalTaxNominal - incomeSurplus);
                rmdExcessUsedForTax = Math.min(rmdExcessNet, taxShortfallAfterIncomeSurplus);
                const netCashNeeded = Math.max(0, taxShortfallAfterIncomeSurplus - rmdExcessNet);

                if (netCashNeeded > 0) {
                    // The gross-up dollar comes from whichever account still has room,
                    // continuing the same taxable -> traditional -> Roth waterfall the
                    // base withdrawal used.
                    const taxableStart = withdrawalAccounts.taxable.stock + withdrawalAccounts.taxable.bond;
                    const traditionalStart = withdrawalAccounts.traditional.stock + withdrawalAccounts.traditional.bond;
                    let source;
                    if (taxableStart - baseWithdrawal.taxableWithdrawalNominal > GROSS_UP_EPSILON) {
                        source = 'taxable';
                    } else if (traditionalStart - baseWithdrawal.traditionalWithdrawalNominal > GROSS_UP_EPSILON) {
                        source = 'traditional';
                    } else {
                        source = 'roth';
                    }
                    // Clamp well below 100% as a safety net against a division blow-up;
                    // real combined marginal rates never approach this in practice.
                    const marginalRate = Math.min(0.9, estimateWithdrawalMarginalRate(
                        source, baseTaxRow, taxContextBase.stateTaxRate, taxContextBase.taxableBasisFraction
                    ));
                    additionalWithdrawalForTaxes = netCashNeeded / (1 - marginalRate);
                }
            }

            // Whatever the RMD-excess net cash didn't have to cover for taxes above is
            // what's actually deposited to Roth.
            const rmdExcessRothDeposit = rmdExcessNet - rmdExcessUsedForTax;

            const withdrawalRow = calculateWithdrawalYear(
                year,
                {
                    ...yearWithdrawalContext,
                    additionalWithdrawalForTaxes,
                    rothConversionAmount: rothConversionForYear,
                    rothConversionNetDeposit,
                    rmdExcessRequestedNominal: baseWithdrawal.rmdExcessNominal,
                    rmdExcessNetDeposit: rmdExcessRothDeposit,
                },
                withdrawalAccounts
            );
            withdrawalRows.push(withdrawalRow);
            // Recomputed against the final (possibly grossed-up) withdrawal amounts so
            // the displayed tax always matches the displayed withdrawal; since this is a
            // one-shot estimate rather than an iterative solve, it may not be an exact
            // break-even (the gross-up's own marginal tax isn't grossed up further).
            taxRows.push(calculateTaxYear(
                year, buildTaxContext(withdrawalRow, annuityNominal, socialSecurityNominal, otherIncomeNominal)
            ));
        }

        return { expenseRows, withdrawalRows, taxRows };
    }

    const noIrmaaSurcharges = new Array(projectionYears).fill(0);
    const incomePass = computeYearRows(noIrmaaSurcharges);

    // IRMAA looks back 2 tax years, which conveniently sidesteps the circularity of a
    // year's own withdrawals affecting its own Medicare premium; the first two
    // projection years assume no surcharge since that lookback income would fall
    // before this projection starts (during working years, which aren't modeled).
    const irmaaMonthlySurchargeByYear = incomePass.taxRows.map((row, index) => {
        const lookbackIndex = index - IRMAA_LOOKBACK_YEARS;
        if (lookbackIndex < 0) {
            return 0;
        }
        const lookbackRow = incomePass.taxRows[lookbackIndex];
        const yearsFromToday = yearsToRetirement + index;
        const nominalFactor = Math.pow(1 + expenseContext.inflationRate, yearsFromToday);
        return getIrmaaMonthlySurcharge(lookbackRow.magiNominal, lookbackRow.filingStatusRaw, nominalFactor);
    });

    const finalPass = computeYearRows(irmaaMonthlySurchargeByYear);

    renderExpenseProjectionTable(finalPass.expenseRows);
    renderIncomeProjectionTable(annuityRows, socialSecurityRows, otherIncomeRows, finalPass.withdrawalRows);
    renderWithdrawalProjectionTable(finalPass.withdrawalRows);
    renderTaxProjectionTable(finalPass.taxRows);

    document.getElementById('results-tabs').hidden = false;
});
