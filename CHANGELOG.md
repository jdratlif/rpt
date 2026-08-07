# CHANGELOG

## 1.5.0 - 2026-08-07

- add "Self Employment" checkbox for Other Income (primary/spouse); when checked, the full
  15.3% self-employment payroll tax is applied instead of the standard 7.65% employee share
- add "Inflation Adjusted" checkbox for Annuity/pension income (primary/spouse); when
  checked, that person's payment grows with inflation like Social Security instead of
  staying flat
- add "Spouse Inherits" checkbox for primary's Annuity/pension income (default checked);
  when checked and the primary dies, that income carries on to the spouse instead of
  stopping
- add version label
- update button colors and placement

## 1.4.0 - 2026-08-07

- combine income projection tables
- add FAQ about IRMAA calculations and inflation
- fix RMD tax calculations when excess money gets moved into Roth
- don't include tax gross up in traditional withdrawal
  - Total is now max(RMD, Traditional) + Roth + Taxable + Tax Gross Up (an additional Traditional withdrawal).
- update default scenario

## 1.3.1 - 2026-08-07

- update IRMAA penalty to include part D surcharge

## 1.3.0 - 2006-08-06

- treat excess RMD (beyond what's needed for expenses/taxes) as a Roth conversion instead of unmodeled spending

## 1.2.0 - 2026-08-06

- add annuitized expenses
- align pre-medicare expenses
- add custom labels for one-time and temporary expenses
- display sum of medical expenses instead of individual when married
- improve sequence of returns generation
  - allow custom percentages and time periods

## 1.1.0 - 2026-08-05

- add adjustable RMD start age
- add other income (part time employment, side hustles, etc)
- allow unlimited one time / temporary expenses

## 1.0.1 - 2026-08-03

- fix senior deduction from using spouse age when single

## 1.0.0 - 2026-08-02

- initial release
