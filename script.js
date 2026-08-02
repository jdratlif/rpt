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

// These inputs only matter when there's a spouse to apply them to; disabling them
// when "has-spouse" is unchecked means users don't have to manually zero out each
// one to get a clean Single-filer projection.
const SPOUSE_ONLY_INPUT_IDS = [
    'widow-age', 'spouse-current-age', 'spouse-social-security-age', 'spouse-annuity-age',
    'social-security-secondary-benefit', 'annuity-secondary-income', 'pre-medicare-expenses-spouse',
];

function updateSpouseInputsDisabled() {
    const hasSpouse = document.getElementById('has-spouse').checked;
    SPOUSE_ONLY_INPUT_IDS.forEach((id) => {
        document.getElementById(id).disabled = !hasSpouse;
    });
}

document.getElementById('has-spouse').addEventListener('change', updateSpouseInputsDisabled);
updateSpouseInputsDisabled();

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
    updateSpouseInputsDisabled();
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

    // Primary is assumed deceased once the spouse reaches widow age, so his own
    // Medicare/pre-Medicare costs stop (the spouse's are unaffected). Only
    // applicable when there's actually a spouse to survive him.
    if (context.hasSpouse && context.widowAge > 0 && spouseAge >= context.widowAge) {
        primaryPreMedicare = 0;
        primaryMedicare = 0;
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
        temporaryExpenses.reduce((sum, value) => sum + value, 0);
    const total = rawTotal * inflationFactor + irmaaSurchargeNominal * deflationFactor;

    return {
        year: yearIndex,
        primaryAge,
        spouseAge,
        common: common * inflationFactor,
        primaryPreMedicare: primaryPreMedicare * inflationFactor,
        spousePreMedicare: spousePreMedicare * inflationFactor,
        primaryMedicare: primaryMedicare * inflationFactor + primaryIrmaaNominal * deflationFactor,
        spouseMedicare: spouseMedicare * inflationFactor + spouseIrmaaNominal * deflationFactor,
        irmaaSurcharge: irmaaSurchargeNominal * deflationFactor,
        temporaryExpenses: temporaryExpenses.map((value) => value * inflationFactor),
        total,
        totalNominal: rawTotal * nominalFactor + irmaaSurchargeNominal,
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
            <td>${formatResultCurrency(row.irmaaSurcharge)}</td>
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

// SECURE 2.0 requires traditional IRA/401(k) distributions to begin at age 73
// (current law through 2032; rises to 75 in 2033, which this simplified
// calculator doesn't model).
const RMD_AGE = 73;

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
// long as possible. Everything here runs in nominal dollars; the today's-dollars
// conversion (like the annuity's) is only applied to the returned display values.
// Any surplus (guaranteed income exceeding expenses) isn't reinvested -- it's
// simply left unmodeled as extra cash flow outside the portfolio.
function calculateWithdrawalYear(yearIndex, context, accounts) {
    const primaryAge = context.retirementAge + (yearIndex - 1);
    const spouseAge = context.spouseAgeAtRetirement + (yearIndex - 1);

    const shortfall = Math.max(0, context.expensesNominal - context.incomeNominal);

    // RMDs are based on the traditional balance at the end of the prior year (i.e.
    // its balance here, before this year's withdrawal) and the primary's age;
    // widow status is ignored for this calculation for simplicity.
    const traditionalBalanceBeforeWithdrawal = accounts.traditional.stock + accounts.traditional.bond;
    const rmdAmount = primaryAge >= RMD_AGE
        ? traditionalBalanceBeforeWithdrawal / getRmdDivisor(primaryAge)
        : 0;

    let remaining = shortfall;
    const taxableWithdrawal = withdrawFromAccount(accounts.taxable, remaining);
    remaining -= taxableWithdrawal;

    // The traditional withdrawal must be bumped up to the RMD even if that's more
    // than needed to cover expenses; the unneeded excess is simply left unmodeled
    // as extra cash flow outside the portfolio, like any other income surplus.
    const traditionalWithdrawal = withdrawFromAccount(accounts.traditional, Math.max(remaining, rmdAmount));
    remaining = Math.max(0, remaining - traditionalWithdrawal);

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
        rmdAmount: rmdAmount * deflationFactor,
        taxableWithdrawal: taxableWithdrawal * deflationFactor,
        traditionalWithdrawal: traditionalWithdrawal * deflationFactor,
        rothWithdrawal: rothWithdrawal * deflationFactor,
        totalWithdrawal: (taxableWithdrawal + traditionalWithdrawal + rothWithdrawal) * deflationFactor,
        taxableBalance: taxableBalance * deflationFactor,
        traditionalBalance: traditionalBalance * deflationFactor,
        rothBalance: rothBalance * deflationFactor,
        totalBalance: (taxableBalance + traditionalBalance + rothBalance) * deflationFactor,
        // Already nominal -- needed by the tax projection regardless of display mode.
        taxableWithdrawalNominal: taxableWithdrawal,
        traditionalWithdrawalNominal: traditionalWithdrawal,
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
            <td>${formatResultCurrency(row.rmdAmount)}</td>
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

// 2026 Medicare Part B IRMAA tiers (ssa.gov): the surcharge added on top of the
// base Part B premium once MAGI exceeds each threshold. The surcharge dollar
// amounts are the same for both filing statuses; only the MAGI breakpoints differ.
// Part D also carries an IRMAA surcharge, but it's not modeled since this app
// doesn't have a base Part D premium input (it varies too widely by plan).
const IRMAA_PART_B_TIERS = [
    { singleMagiOver: 0, mfjMagiOver: 0, surcharge: 0 },
    { singleMagiOver: 109000, mfjMagiOver: 218000, surcharge: 81.20 },
    { singleMagiOver: 137000, mfjMagiOver: 274000, surcharge: 202.90 },
    { singleMagiOver: 171000, mfjMagiOver: 342000, surcharge: 324.60 },
    { singleMagiOver: 205000, mfjMagiOver: 410000, surcharge: 446.30 },
    { singleMagiOver: 500000, mfjMagiOver: 750000, surcharge: 487.00 },
];

// IRMAA is assessed using MAGI from 2 tax years prior, which conveniently avoids
// any circularity with the current year's own withdrawals/expenses (unlike, say,
// grossing up a withdrawal to cover its own resulting tax bill would).
const IRMAA_LOOKBACK_YEARS = 2;

// Thresholds and surcharge dollar amounts are inflated to the premium year's
// nominal dollars (nominalFactor), the same convention used for tax brackets;
// magi is assumed already expressed in that same year's nominal terms.
function getIrmaaMonthlySurcharge(magi, filingStatus, nominalFactor) {
    let surcharge = 0;
    for (const tier of IRMAA_PART_B_TIERS) {
        const threshold = (filingStatus === 'mfj' ? tier.mfjMagiOver : tier.singleMagiOver) * nominalFactor;
        if (magi > threshold) {
            surcharge = tier.surcharge * nominalFactor;
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
    } else if (spouseAge >= 65) {
        seniorDeduction += context.seniorDeductionSingle;
    }
    const standardDeduction =
        ((filingStatus === 'mfj' ? context.standardDeductionMfj : context.standardDeductionSingle) + seniorDeduction) *
        nominalFactor;

    const ordinaryIncomeBeforeSS = context.traditionalWithdrawalNominal + context.annuityNominal;
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

    const totalTax = federalIncomeTax + niit + stateTax;
    const deflationFactor = context.showTodaysDollars ? 1 / nominalFactor : 1;

    return {
        year: yearIndex,
        primaryAge,
        spouseAge,
        filingStatus: filingStatus === 'mfj' ? 'MFJ' : 'Single',
        // Raw (lowercase) values, plus the nominal MAGI, feed the IRMAA lookback
        // 2 years later -- keep these nominal/unconverted regardless of display mode.
        filingStatusRaw: filingStatus,
        magiNominal,
        ordinaryIncome: ordinaryIncome * deflationFactor,
        ltcgIncome: ltcgIncome * deflationFactor,
        taxableSocialSecurity: taxableSocialSecurity * deflationFactor,
        standardDeduction: standardDeduction * deflationFactor,
        federalIncomeTax: federalIncomeTax * deflationFactor,
        niit: niit * deflationFactor,
        stateTax: stateTax * deflationFactor,
        totalTax: totalTax * deflationFactor,
    };
}

function renderTaxProjectionTable(rows) {
    const tbody = document.getElementById('tax-projection-tbody');
    tbody.innerHTML = '';

    rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.year}</td>
            <td>${row.primaryAge}</td>
            <td>${row.spouseAge}</td>
            <td>${row.filingStatus}</td>
            <td>${formatResultCurrency(row.ordinaryIncome)}</td>
            <td>${formatResultCurrency(row.ltcgIncome)}</td>
            <td>${formatResultCurrency(row.taxableSocialSecurity)}</td>
            <td>${formatResultCurrency(row.standardDeduction)}</td>
            <td>${formatResultCurrency(row.federalIncomeTax)}</td>
            <td>${formatResultCurrency(row.niit)}</td>
            <td>${formatResultCurrency(row.stateTax)}</td>
            <td class="total-cell">${formatResultCurrency(row.totalTax)}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('tax-projection-section').hidden = false;
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
        hasSpouse: document.getElementById('has-spouse').checked,
        widowAge: parseFloat(document.getElementById('widow-age').value) || 0,
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

    renderSocialSecurityProjectionTable(socialSecurityRows);

    // Start from the actual retirement-age stock/bond split (which may have drifted
    // from stockFraction/bondFraction) rather than the plain traditional/roth/taxable
    // totals, so withdrawals and post-withdrawal growth apply to the real mix.
    const startingAccounts = {
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

        const withdrawalRows = [];
        for (let year = 1; year <= projectionYears; year++) {
            const expensesNominal = expenseRows[year - 1].totalNominal;
            const incomeNominal = annuityRows[year - 1].totalNominal + socialSecurityRows[year - 1].totalNominal;
            const yearContext = { ...withdrawalContextBase, expensesNominal, incomeNominal };
            withdrawalRows.push(calculateWithdrawalYear(year, yearContext, withdrawalAccounts));
        }

        const taxRows = [];
        for (let year = 1; year <= projectionYears; year++) {
            const yearContext = {
                ...taxContextBase,
                traditionalWithdrawalNominal: withdrawalRows[year - 1].traditionalWithdrawalNominal,
                taxableWithdrawalNominal: withdrawalRows[year - 1].taxableWithdrawalNominal,
                annuityNominal: annuityRows[year - 1].totalNominal,
                socialSecurityNominal: socialSecurityRows[year - 1].totalNominal,
            };
            taxRows.push(calculateTaxYear(year, yearContext));
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
    renderWithdrawalProjectionTable(finalPass.withdrawalRows);
    renderTaxProjectionTable(finalPass.taxRows);
});
