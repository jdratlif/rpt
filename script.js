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

document.querySelectorAll('.currency-input').forEach((input) => {
    formatCurrencyInput(input);

    input.addEventListener('input', () => {
        // Preserve cursor position relative to the end of the value so
        // typing/deleting in the middle of a number doesn't jump the caret.
        const distanceFromEnd = input.value.length - input.selectionStart;
        formatCurrencyInput(input);
        const newPos = input.value.length - distanceFromEnd;
        input.setSelectionRange(newPos, newPos);
    });
});

// Strips a percent input down to digits and a single decimal point.
function formatPercentInput(input) {
    let raw = input.value.replace(/[^\d.]/g, '');
    const firstDot = raw.indexOf('.');
    if (firstDot !== -1) {
        raw = raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, '');
    }
    input.value = raw;
}

// Clamps a percent input's value to the valid 0-100 range.
function clampPercentInput(input) {
    if (input.value === '') {
        return;
    }
    const value = parseFloat(input.value);
    input.value = isNaN(value) ? '' : String(Math.min(100, Math.max(0, value)));
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

// Manually restore each field's original HTML value (defaultValue) instead of using a
// native reset button, since the browser's "reset" event fires *before* fields are
// reset, which would reformat stale values instead of the restored defaults.
document.getElementById('reset-btn').addEventListener('click', () => {
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
