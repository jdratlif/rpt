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

    const rawTotal = common + primaryPreMedicare + spousePreMedicare + primaryMedicare + spouseMedicare +
        temporaryExpenses.reduce((sum, value) => sum + value, 0);

    const yearsFromToday = context.yearsToRetirement + (yearIndex - 1);
    // nominalFactor is always applied (unlike inflationFactor below) since the
    // withdrawal simulation needs true nominal dollars regardless of display mode.
    const nominalFactor = Math.pow(1 + context.inflationRate, yearsFromToday);
    const inflationFactor = context.showTodaysDollars ? 1 : nominalFactor;
    const total = rawTotal * inflationFactor;

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
        totalNominal: rawTotal * nominalFactor,
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

// Annuity payments are fixed nominal amounts once they start (no inflation raises).
// So in nominal mode the payment stays flat, but in "today's dollars" mode its
// purchasing power shrinks over time, so we deflate it instead of inflating it.
function calculateAnnuityYear(yearIndex, context) {
    const primaryAge = context.retirementAge + (yearIndex - 1);
    const spouseAge = context.spouseAgeAtRetirement + (yearIndex - 1);

    let primaryAnnuity = primaryAge >= context.primaryAnnuityAge ? context.primaryAnnuityIncome * 12 : 0;
    const spouseAnnuity = spouseAge >= context.spouseAnnuityAge ? context.spouseAnnuityIncome * 12 : 0;

    // Primary is assumed deceased once the spouse reaches widow age; no survivor
    // benefit carries over for the annuity, it simply stops.
    if (context.widowAge > 0 && spouseAge >= context.widowAge) {
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
        primaryAnnuity: primaryAnnuity * deflationFactor,
        spouseAnnuity: spouseAnnuity * deflationFactor,
        total: (primaryAnnuity + spouseAnnuity) * deflationFactor,
        // Already nominal (flat, non-COLA'd) -- no factor needed for the withdrawal simulation.
        totalNominal: primaryAnnuity + spouseAnnuity,
    };
}

function renderAnnuityProjectionTable(rows) {
    const tbody = document.getElementById('annuity-projection-tbody');
    tbody.innerHTML = '';

    rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.year}</td>
            <td>${row.primaryAge}</td>
            <td>${row.spouseAge}</td>
            <td>${formatResultCurrency(row.primaryAnnuity)}</td>
            <td>${formatResultCurrency(row.spouseAnnuity)}</td>
            <td class="total-cell">${formatResultCurrency(row.total)}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('annuity-projection-section').hidden = false;
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
    let spouseSS = spouseAge >= context.spouseClaimAge ? context.spouseMonthlyBenefit * 12 : 0;

    // Primary is assumed deceased once the spouse reaches widow age; the widow
    // steps up to whichever of the two (claim-age-adjusted) benefits is larger.
    if (context.widowAge > 0 && spouseAge >= context.widowAge) {
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
        primarySS: primarySS * inflationFactor,
        spouseSS: spouseSS * inflationFactor,
        total: (primarySS + spouseSS) * inflationFactor,
        totalNominal: (primarySS + spouseSS) * nominalFactor,
    };
}

function renderSocialSecurityProjectionTable(rows) {
    const tbody = document.getElementById('social-security-projection-tbody');
    tbody.innerHTML = '';

    rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.year}</td>
            <td>${row.primaryAge}</td>
            <td>${row.spouseAge}</td>
            <td>${formatResultCurrency(row.primarySS)}</td>
            <td>${formatResultCurrency(row.spouseSS)}</td>
            <td class="total-cell">${formatResultCurrency(row.total)}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('social-security-projection-section').hidden = false;
}

// Each year, withdraws the shortfall between expenses and guaranteed income
// (annuity + Social Security) from the portfolio -- taxable first, then
// traditional (pre-tax), then Roth last, preserving tax-advantaged growth as
// long as possible. Everything here runs in nominal dollars; the today's-dollars
// conversion (like the annuity's) is only applied to the returned display values.
// Any surplus (guaranteed income exceeding expenses) isn't reinvested -- it's
// simply left unmodeled as extra cash flow outside the portfolio.
function calculateWithdrawalYear(yearIndex, context, accounts) {
    const primaryAge = context.retirementAge + (yearIndex - 1);
    const spouseAge = context.spouseAgeAtRetirement + (yearIndex - 1);

    const shortfall = Math.max(0, context.expensesNominal - context.incomeNominal);

    let remaining = shortfall;
    const taxableWithdrawal = withdrawFromAccount(accounts.taxable, remaining);
    remaining -= taxableWithdrawal;
    const traditionalWithdrawal = withdrawFromAccount(accounts.traditional, remaining);
    remaining -= traditionalWithdrawal;
    const rothWithdrawal = withdrawFromAccount(accounts.roth, remaining);
    remaining -= rothWithdrawal;

    // Whatever remains after the withdrawal grows for the rest of the year, so the
    // ending balance reflects a full year of stock/bond returns on the reduced base.
    growAccount(accounts.taxable, context.monthlyStockReturn, context.monthlyBondReturn, 12);
    growAccount(accounts.traditional, context.monthlyStockReturn, context.monthlyBondReturn, 12);
    growAccount(accounts.roth, context.monthlyStockReturn, context.monthlyBondReturn, 12);

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
        taxableWithdrawal: taxableWithdrawal * deflationFactor,
        traditionalWithdrawal: traditionalWithdrawal * deflationFactor,
        rothWithdrawal: rothWithdrawal * deflationFactor,
        totalWithdrawal: (taxableWithdrawal + traditionalWithdrawal + rothWithdrawal) * deflationFactor,
        taxableBalance: taxableBalance * deflationFactor,
        traditionalBalance: traditionalBalance * deflationFactor,
        rothBalance: rothBalance * deflationFactor,
        totalBalance: (taxableBalance + traditionalBalance + rothBalance) * deflationFactor,
    };
}

function renderWithdrawalProjectionTable(rows) {
    const tbody = document.getElementById('withdrawal-projection-tbody');
    tbody.innerHTML = '';

    rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.year}</td>
            <td>${row.primaryAge}</td>
            <td>${row.spouseAge}</td>
            <td>${formatResultCurrency(row.taxableWithdrawal)}</td>
            <td>${formatResultCurrency(row.traditionalWithdrawal)}</td>
            <td>${formatResultCurrency(row.rothWithdrawal)}</td>
            <td class="total-cell">${formatResultCurrency(row.totalWithdrawal)}</td>
            <td>${formatResultCurrency(row.taxableBalance)}</td>
            <td>${formatResultCurrency(row.traditionalBalance)}</td>
            <td>${formatResultCurrency(row.rothBalance)}</td>
            <td class="total-cell">${formatResultCurrency(row.totalBalance)}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('withdrawal-projection-section').hidden = false;
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

    const annuityContext = {
        retirementAge,
        yearsToRetirement,
        spouseAgeAtRetirement: expenseContext.spouseAgeAtRetirement,
        showTodaysDollars: expenseContext.showTodaysDollars,
        inflationRate: expenseContext.inflationRate,
        widowAge: parseFloat(document.getElementById('widow-age').value) || 0,
        primaryAnnuityAge: parseFloat(document.getElementById('primary-annuity-age').value) || 0,
        spouseAnnuityAge: parseFloat(document.getElementById('spouse-annuity-age').value) || 0,
        primaryAnnuityIncome: parseCurrencyInput(document.getElementById('annuity-primary-income')),
        spouseAnnuityIncome: parseCurrencyInput(document.getElementById('annuity-secondary-income')),
    };

    const annuityRows = [];
    for (let year = 1; year <= projectionYears; year++) {
        annuityRows.push(calculateAnnuityYear(year, annuityContext));
    }

    renderAnnuityProjectionTable(annuityRows);

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

    renderSocialSecurityProjectionTable(socialSecurityRows);

    // Start from the actual retirement-age stock/bond split (which may have drifted
    // from stockFraction/bondFraction) rather than the plain traditional/roth/taxable
    // totals, so withdrawals and post-withdrawal growth apply to the real mix.
    const withdrawalAccounts = {
        taxable: { stock: taxableAccount.stock, bond: taxableAccount.bond },
        traditional: { stock: traditionalAccount.stock, bond: traditionalAccount.bond },
        roth: { stock: rothAccount.stock, bond: rothAccount.bond },
    };

    const withdrawalContextBase = {
        retirementAge,
        yearsToRetirement,
        spouseAgeAtRetirement: expenseContext.spouseAgeAtRetirement,
        showTodaysDollars: expenseContext.showTodaysDollars,
        inflationRate: expenseContext.inflationRate,
        monthlyStockReturn,
        monthlyBondReturn,
    };

    const withdrawalRows = [];
    for (let year = 1; year <= projectionYears; year++) {
        const expensesNominal = expenseRows[year - 1].totalNominal;
        const incomeNominal = annuityRows[year - 1].totalNominal + socialSecurityRows[year - 1].totalNominal;
        const yearContext = { ...withdrawalContextBase, expensesNominal, incomeNominal };
        withdrawalRows.push(calculateWithdrawalYear(year, yearContext, withdrawalAccounts));
    }

    renderWithdrawalProjectionTable(withdrawalRows);
});
