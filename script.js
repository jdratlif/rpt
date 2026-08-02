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

// Grows a starting balance to retirement using monthly-compounded stock/bond
// returns, adding a monthly contribution (split across stock/bond in the same
// proportion as the balance) each month. Monthly compounding is used instead of
// a single annual lump-sum growth step because contributions actually arrive
// throughout the year and should start compounding as soon as they land.
function projectAccountBalance(
    startingBalance, monthlyContribution, stockFraction, bondFraction,
    monthlyStockReturn, monthlyBondReturn, months
) {
    let stockValue = startingBalance * stockFraction;
    let bondValue = startingBalance * bondFraction;
    const contributionStock = monthlyContribution * stockFraction;
    const contributionBond = monthlyContribution * bondFraction;

    for (let month = 0; month < months; month++) {
        stockValue = stockValue * (1 + monthlyStockReturn) + contributionStock;
        bondValue = bondValue * (1 + monthlyBondReturn) + contributionBond;
    }

    return stockValue + bondValue;
}

// Formats a plain number as whole-dollar currency for read-only result display.
function formatResultCurrency(value) {
    return `$${Math.round(value).toLocaleString()}`;
}

// Calculates one projection year's expenses. Inputs are assumed to be given in
// today's (primary's current age) dollars; when not showing "today's dollars",
// they're inflated up to that year's nominal amount using yearsFromToday, which
// spans from the primary's current age through the given projection year.
function calculateExpenseYear(yearIndex, context) {
    const primaryAge = context.retirementAge + (yearIndex - 1);
    const spouseAge = context.spouseAgeAtRetirement + (yearIndex - 1);

    const common = context.monthlyExpenses * 12;
    const primaryPreMedicare = primaryAge < 65 ? context.primaryPreMedicareExpenses * 12 : 0;
    const spousePreMedicare = spouseAge < 65 ? context.spousePreMedicareExpenses * 12 : 0;
    // Part B is a fixed per-person premium once Medicare eligibility starts at 65;
    // Part D is excluded since its premium varies widely by plan.
    const primaryMedicare = primaryAge >= 65 ? context.medicarePartBPremium * 12 : 0;
    const spouseMedicare = spouseAge >= 65 ? context.medicarePartBPremium * 12 : 0;
    const temporaryExpenses = context.temporaryExpenses.map((expense) =>
        (primaryAge >= expense.startAge && primaryAge <= expense.endAge) ? expense.amount * 12 : 0
    );

    const yearsFromToday = context.yearsToRetirement + (yearIndex - 1);
    const inflationFactor = context.showTodaysDollars
        ? 1
        : Math.pow(1 + context.inflationRate, yearsFromToday);

    const total = (common + primaryPreMedicare + spousePreMedicare + primaryMedicare + spouseMedicare +
        temporaryExpenses.reduce((sum, value) => sum + value, 0)) * inflationFactor;

    return {
        year: yearIndex,
        primaryAge,
        spouseAge,
        common: common * inflationFactor,
        primaryPreMedicare: primaryPreMedicare * inflationFactor,
        spousePreMedicare: spousePreMedicare * inflationFactor,
        primaryMedicare: primaryMedicare * inflationFactor,
        spouseMedicare: spouseMedicare * inflationFactor,
        temporaryExpenses: temporaryExpenses.map((value) => value * inflationFactor),
        total,
    };
}

function renderExpenseProjectionTable(rows) {
    const tbody = document.getElementById('expense-projection-tbody');
    tbody.innerHTML = '';

    rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.year}</td>
            <td>${row.primaryAge}</td>
            <td>${row.spouseAge}</td>
            <td>${formatResultCurrency(row.common)}</td>
            <td>${formatResultCurrency(row.primaryPreMedicare)}</td>
            <td>${formatResultCurrency(row.spousePreMedicare)}</td>
            <td>${formatResultCurrency(row.primaryMedicare)}</td>
            <td>${formatResultCurrency(row.spouseMedicare)}</td>
            <td>${formatResultCurrency(row.temporaryExpenses[0])}</td>
            <td>${formatResultCurrency(row.temporaryExpenses[1])}</td>
            <td>${formatResultCurrency(row.temporaryExpenses[2])}</td>
            <td class="total-cell">${formatResultCurrency(row.total)}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('expense-projection-section').hidden = false;
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

    const traditionalBalance = projectAccountBalance(
        parseCurrencyInput(document.getElementById('traditional-retirement-balance')),
        parseCurrencyInput(document.getElementById('traditional-monthly-contribution')),
        stockFraction, bondFraction, monthlyStockReturn, monthlyBondReturn, monthsToRetirement
    );
    const rothBalance = projectAccountBalance(
        parseCurrencyInput(document.getElementById('roth-retirement-balance')),
        parseCurrencyInput(document.getElementById('roth-monthly-contribution')),
        stockFraction, bondFraction, monthlyStockReturn, monthlyBondReturn, monthsToRetirement
    );
    const taxableBalance = projectAccountBalance(
        parseCurrencyInput(document.getElementById('taxable-balance')),
        parseCurrencyInput(document.getElementById('taxable-monthly-contribution')),
        stockFraction, bondFraction, monthlyStockReturn, monthlyBondReturn, monthsToRetirement
    );

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

    document.getElementById('results-section').hidden = false;

    const projectionYears = parseFloat(document.getElementById('projection-years').value) || 0;
    const spouseCurrentAge = parseFloat(document.getElementById('spouse-current-age').value) || 0;

    const expenseContext = {
        retirementAge,
        yearsToRetirement,
        spouseAgeAtRetirement: spouseCurrentAge + yearsToRetirement,
        showTodaysDollars: document.getElementById('todays-dollars').checked,
        inflationRate: parsePercentInput(document.getElementById('inflation-percentage')) / 100,
        monthlyExpenses: parseCurrencyInput(document.getElementById('monthly-expenses')),
        primaryPreMedicareExpenses: parseCurrencyInput(document.getElementById('pre-medicare-expenses-primary')),
        spousePreMedicareExpenses: parseCurrencyInput(document.getElementById('pre-medicare-expenses-spouse')),
        medicarePartBPremium: parseCurrencyInput(document.getElementById('medicare-part-b-premium')),
        temporaryExpenses: [1, 2, 3].map((num) => ({
            startAge: parseFloat(document.getElementById(`temporary-expense-${num}-start-age`).value) || 0,
            endAge: parseFloat(document.getElementById(`temporary-expense-${num}-end-age`).value) || 0,
            amount: parseCurrencyInput(document.getElementById(`temporary-expense-${num}-amount`)),
        })),
    };

    const expenseRows = [];
    for (let year = 1; year <= projectionYears; year++) {
        expenseRows.push(calculateExpenseYear(year, expenseContext));
    }

    renderExpenseProjectionTable(expenseRows);
});
