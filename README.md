# Retirement Projection Tool

> **⚠️ Important Disclaimer**
>
> This tool is **NOT financial advice**. Nothing in this project is guaranteed,
> promised, or intended to predict actual future results. It is provided for
> **planning and entertainment purposes only**. Always consult a qualified
> financial professional before making personal financial decisions.

A browser-based retirement scenario projector. It models how a portfolio might
behave across pre-retirement, retirement, and widowhood by combining accounts,
income, expenses, taxes, and user-controlled assumptions.

## What it does

- **Accounts**
  - Tracks taxable, traditional pre-tax, and Roth balances.
  - Models Required Minimum Distributions (RMDs).
  - Supports Roth conversions.

- **Income**
  - Social Security benefits for one or two persons.
  - Annuity or pension income with optional cost-of-living adjustments.

- **Expenses**
  - Recurring living expenses.
  - Separate pre-Medicare and post-Medicare healthcare assumptions.
  - One-time expenses such as vacations or home improvements.
  - Time-limited recurring expenses such as loans.

- **Inflation**
  - Show projections in **today's dollars** or **future dollars**.
  - Adjustable annual inflation rate.

- **Tax projections**
  - Estimates federal, state, NIIT, and long-term capital-gains taxes.
  - Models IRMAA surcharges, RMD-driven tax impacts, and the widow's penalty
    when filing status changes from married to single.
  - Editable tax brackets so you can explore hypothetical future tax increases.

- **Gross-up estimation**
  - Approximates how much extra you may need to withdraw from the portfolio to
    cover taxes on top of your expenses.

- **Advanced stock returns**
  - Override the flat stock-return assumption with per-year returns.
  - Displays the resulting compound annual growth rate (CAGR).
  - Includes good-sequence and bad-sequence generators to explore
    sequence-of-returns risk.

## Usage

Open `index.html` in a modern web browser. All calculations run locally in the
browser; no data is sent to a server.

It is also hosted on [GitHub](https://jdratlif.github.io/rpt/).

You can save a user preset to your browser's local storage and reload it later.

## Technology

This is a vanilla HTML/CSS/JavaScript project with no external build step or
framework.

## License

© 2026 John Ratliff. Licensed under
[CC BY-NC 4.0 (Attribution-NonCommercial)](https://creativecommons.org/licenses/by-nc/4.0/).

Source code is available on [GitHub](https://github.com/jdratlif/rpt).

This project was vibe coded with [GitHub Copilot](https://github.com/features/copilot) using
Qwen Coder 3, Claude Sonnet 5, and Kimi K2.7 Code.
