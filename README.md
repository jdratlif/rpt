# Retirement Projection Tool

> **⚠️ Important Disclaimer**
>
> This tool is **NOT financial advice**. Nothing in this project is guaranteed,
> promised, or intended to predict actual future results. It is provided for
> **planning and entertainment purposes only**. Always consult a qualified
> financial professional before making personal financial decisions.

- [Retirement Projection Tool](#retirement-projection-tool)
  - [What it does](#what-it-does)
  - [Usage](#usage)
  - [Frequently Asked Questions](#frequently-asked-questions)
    - [What is the point of this thing?](#what-is-the-point-of-this-thing)
    - [After a withdrawal, it says the taxable/traditional/roth balance is $0, but it didn't withdraw all the money. Why?](#after-a-withdrawal-it-says-the-taxabletraditionalroth-balance-is-0-but-it-didnt-withdraw-all-the-money-why)
    - [How are payroll taxes calculated?](#how-are-payroll-taxes-calculated)
    - [How does the Gross-Up Function estimate additional withdrawals required to account for taxes?](#how-does-the-gross-up-function-estimate-additional-withdrawals-required-to-account-for-taxes)
    - [How are taxes calculated on taxable brokerage account withdrawals?](#how-are-taxes-calculated-on-taxable-brokerage-account-withdrawals)
    - [What about cash savings?](#what-about-cash-savings)
    - [How are portfolio returns calculated?](#how-are-portfolio-returns-calculated)
    - [What does the Generate Sequence button do in the Advanced Stock Returns Dialog?](#what-does-the-generate-sequence-button-do-in-the-advanced-stock-returns-dialog)
    - [What if I have pension income?](#what-if-i-have-pension-income)
    - [Is the annuity income adjusted for inflation?](#is-the-annuity-income-adjusted-for-inflation)
    - [What if my pension income is adjusted for inflation?](#what-if-my-pension-income-is-adjusted-for-inflation)
    - [Does the primary's annuity/pension continue to the spouse after death?](#does-the-primarys-annuitypension-continue-to-the-spouse-after-death)
    - [What are RMDs?](#what-are-rmds)
    - [What is IRMAA?](#what-is-irmaa)
    - [Does this tool show the impact of the widow's penalty?](#does-this-tool-show-the-impact-of-the-widows-penalty)
    - [Why are the XYZ expenses so low? No one can live on that! Medical alone is like $15,000/year!](#why-are-the-xyz-expenses-so-low-no-one-can-live-on-that-medical-alone-is-like-15000year)
    - [What are the temporary expenses for?](#what-are-the-temporary-expenses-for)
    - [How are the temporary expenses different from the one time expenses?](#how-are-the-temporary-expenses-different-from-the-one-time-expenses)
    - [The government has to raise taxes to pay off the debt. Why are you assuming tax rates will be the same?](#the-government-has-to-raise-taxes-to-pay-off-the-debt-why-are-you-assuming-tax-rates-will-be-the-same)
    - [What does the "Show in Today's Dollars" checkbox do?](#what-does-the-show-in-todays-dollars-checkbox-do)
    - [Why do all these retirement scenarios assume you're married? What about the single people?](#why-do-all-these-retirement-scenarios-assume-youre-married-what-about-the-single-people)
    - [Why are some of the RMD values in the Portfolio projection table highlighted with an arrow?](#why-are-some-of-the-rmd-values-in-the-portfolio-projection-table-highlighted-with-an-arrow)
    - [What is NIIT?](#what-is-niit)
    - [How are state taxes calculated?](#how-are-state-taxes-calculated)
    - [Why isn't there an IRMAA surcharge when my income from 2 years ago is above the threshold?](#why-isnt-there-an-irmaa-surcharge-when-my-income-from-2-years-ago-is-above-the-threshold)
    - [Can I copy this to my website? It's free right?](#can-i-copy-this-to-my-website-its-free-right)
  - [Technology](#technology)
  - [License](#license)

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

## Frequently Asked Questions

### What is the point of this thing?

I spend a a lot of time watching retirement YouTube channels and thinking about retirement and investing.

All the retirement calculators on the internet are very basic.
If a channel has a cool spreadsheet, even if they say it's free, they want you to sign up for a newsletter at a mininum.
Often they want you to buy their course.

After reading a million YouTube comments, I saw recurring themes and concerns people had.
People are really worried about RMDs, IRMAA, and the widow's penalty.
They didn't seem as impactful as people said they were.
So I decided to write a calculator based on what I've learned on YouTube.

Along the way, I added a bunch more features based on things that were either personally applicable to me,
or things I've seen in YouTube videos and comments.

### After a withdrawal, it says the taxable/traditional/roth balance is $0, but it didn't withdraw all the money. Why?

It will do this when showing in real (e.g. Today's) dollars because it accounted for inflation.
When showing future (e.g. nominal) dollars, the values will match exactly.

### How are payroll taxes calculated?

For other income, the tool assumes this is standard W-2 income and uses 7.65%, unless the
"Self Employment" checkbox next to that person's Other Income amount is checked, in which
case the full 15.3% self-employment rate is used instead.
Payroll taxes are not applied to Social Security, Annuity/Pension, or non-Roth portfolio withdrawals.

### How does the Gross-Up Function estimate additional withdrawals required to account for taxes?

It estimates the taxes that would be owed for all income sources required to satisfy expenses for the year.
It calculates an effective rate of tax based on the amount, and adds this amount as an additional portfolio withdrawal.
It does not act recursively, and is a rough estimate.

### How are taxes calculated on taxable brokerage account withdrawals?

In the rates section, there is a taxable basis input (20% by default).
It assumes all withdrawals are subject to long term capital gains rates and applies tax to the non-basis percentage.
So if your LTCG rate is 15%, you withdraw $10,000 from taxable, and your basis % is 20%, your tax is $1200.
(10000 \* (100% - 20%) \* 15% = 1200).

### What about cash savings?

Include all fixed income assets in the bond portioin of your portfolio.
They all work similarly enough that separating them out didn't seem worth it.

### How are portfolio returns calculated?

The current balance of your portfolio is separated into stocks and bonds by percentage weight from the portfolio tab.
Bonds are flatly increased by the bond percentage each year.
By default, stocks are also flatly increased by the stock percentage each year.
If you select 'Use Advanced Stock Returns', you can set the percentage return on a per-year basis to simulate any
sequence of returns you want to model.

### What does the Generate Sequence button do in the Advanced Stock Returns Dialog?

They calculate an effective drop or raise in the portfolio over a defined period at the beginning of retirement to
simulate sequence of returns risk.
After the drop (or gain for a positive percentage), returns are increased (or lowered) to revert to the mean over the
projection timeline.

### What if I have pension income?

Use the annuity income section.

### Is the annuity income adjusted for inflation?

Not by default, since most annuities don't have an inflation rider.
If yours does (or your pension has a COLA),
check the "Inflation Adjusted" box next to that person's annuity amount and
it will grow with inflation just like Social Security.

### What if my pension income is adjusted for inflation?

Check the "Inflation Adjusted" checkbox next to that person's annuity amount in the Annuity
section -- pension income is entered there too.

### Does the primary's annuity/pension continue to the spouse after death?

By default, yes -- the "Spouse Inherits" checkbox next to the primary's annuity amount is
checked by default, so if the primary dies (see Widow Age), that income is added to the
spouse's own annuity income for the rest of the projection. Uncheck it if the
annuity/pension has no survivor benefit and the payments simply stop.

### What are RMDs?

Required Minimum Distributions.
The government mandates that you withdraw a certain percentage of your pre-tax accounts every year once you reach a
certain age (73 for most people) whether you want it or not.
This can increase taxes for people later in life if they have large pre-tax balances.

### What is IRMAA?

Income Related Monthly Adjustment Amount.
It's an additional medicare premium for high earners based on their income from 2 years prior.

### Does this tool show the impact of the widow's penalty?

Yes.
If you checked Married in the Ages section and set a widow age, the primary will be considered to have died the year the
spouse reaches the widow age.
In all of the projection tables under Ages, when the spouse is a widow, you will see a grave marker for the primary.
On the taxes projection, you will see filing status change from MFJ ro Single.
You can see how the marginal and effective tax rates for that year differ from the previous year.
This has been dubbed the widow's penalty, because you probably have similar income, but in the smaller single tax brackets.
In the default scenario, the primary passes away when the spouse is 78, the marginal rate goes from 12->22%, and the
effective rate jumps from 8.6%->12.1%.

### Why are the XYZ expenses so low? No one can live on that! Medical alone is like $15,000/year!

I based the default scenario off my experiences living in southern Indiana, a lower cost of living area.
Pre-medicare expenses are based on ACA marketplace plans with tax subsidies for lower income people.
Medicare expenses are based on the current part B premium and the average for part D.
If this doesn't fit your life, you should change the values to fit your scenario.
This calculator is just trying to give reasonable estimates based on a large number of assumptions.

### What are the temporary expenses for?

The idea is to put your expense floor in the monthly expenses.
These are the things you need just to live (e.g. housing, food, transportation).
Some expenses are temporary.
You may be paying off a mortgage or car loan.
Once the mortgage is paid off, you still have property taxes, insurance and maintenance, so maybe you put that in general
and put the non-escrow portion as a temporary expense.
You might want to account for a larger travel budget early in retirement when you're more healthy.
It's basically to get a better estimate of expenses, which are almost certainly not fixed for 30+ years.

### How are the temporary expenses different from the one time expenses?

The idea is for these to be big ticket items that you think will be needed.
A new roof for the house, new vehicle(s), new HVAC system, or an amazing bucket list vacation.

### The government has to raise taxes to pay off the debt. Why are you assuming tax rates will be the same?

I'm going with the only information I have right now, which is the current tax rates as of 2026.
The program automatically inflates the brackets, but that's all it does.
If you think taxes will be higher in the future, you can edit the tax tables in the rates section.

### What does the "Show in Today's Dollars" checkbox do?

It calculates the effect of inflation on dollar amounts in the portfolio, other income sources, and expenses.
Expenses are increased by inflation each year.
Portfolio gains are offset by inflation (i.e. 7% gains - 3% inflation = 4% real growth).
Social Security and Other Income are increased by inflation, but annuity/pension income is not
unless its "Inflation Adjusted" checkbox is checked.
It's easier to understand the numbers in terms of today's dollars, because you know what things cost right now.

### Why do all these retirement scenarios assume you're married? What about the single people?

Just uncheck the Married checkbox and you can calculate the effects of retiring single.

### Why are some of the RMD values in the Portfolio projection table highlighted with an arrow?

This means the RMD exceeded what you would have needed to withdraw to cover expenses.
If your RMD was $25,000, but you only needed $10,000 to cover expenses, it would be highlighted to indicate that.
The $15,000 excess is assumed to be saved rather than spent, so (net of an estimated tax on it) it's treated as a
Roth conversion and shown in the Conversion column of the Portfolio Withdrawal Projection table.

### What is NIIT?

Net Investment Income Tax.
It's a tax for people who are rich.
I'm not rich so I have no idea how it works.
AI asked if I wanted to figure it in, and I said okay.
I'm pretty sure it only applies to taxable brokerage accounts.

### How are state taxes calculated?

It's a flat rate defaulting to 5% (because that's what I pay in Indiana).
You can change it in the Rates section by clicking 'Edit Tax Tables (Advanced)'.
There's a box for whether SS is taxed, which is calculated as the same amount that would be taxed federally.
I'm sure there are more complicated tax systems in some states, but I think it's good enough for an internet calculator.

### Why isn't there an IRMAA surcharge when my income from 2 years ago is above the threshold?

The progam compares your 2-year old income to the inflation adjusted thresholds.
So if the MFJ threshold is ~$218K two years ago, a 3% inflation factor would make it ~$231K today.
So unless your income 2 years ago is over $231K when MFJ, IRMAA would not be calculated.
I'm not sure if this is correct.
Open an issue and leave a compelling argument on GitHub and maybe I'll change it.

### Can I copy this to my website? It's free right?

I'd prefer you didn't.
I spend a lot of time on retirement YouTube, reading the comments, and thinking about what matters for retirement projections.
I've seen a lot of other calculators, and they're always very basic.
To go beyond that, you have to pay for Boldin or Projection Lab, and they're pretty complicated.
I wanted a middle ground, and although AI wrote all the code, I designed it.
I'd like there to be one place for this.
If you want a feature that doesn't exist, make a pull request and everyone can benefit.
It's licensed under the Creative Commons, so as long as you credit me and don't sell it
(which includes putting it on a webpage with ads), you can do that.
I like open source, but I really don't want 20 versions of this in different states.
It's on public github.
I released it to the public.
It's not going anywhere.
If you're worried I'll change my mind, feel free to fork it or clone it or back it up.
But please don't put this on your website, take my name off, and put a bunch of ads.
I can't stop you, but you're a bad person if you do that.

## Technology

This is a vanilla HTML/CSS/JavaScript project with no external build step or
framework.

## License

© 2026 John Ratliff. Licensed under
[CC BY-NC 4.0 (Attribution-NonCommercial)](https://creativecommons.org/licenses/by-nc/4.0/).

Source code is available on [GitHub](https://github.com/jdratlif/rpt).

This project was vibe coded with [GitHub Copilot](https://github.com/features/copilot) using
Qwen Coder 3, GPT OSS 120b, Claude Sonnet 5, and Kimi K2.7 Code.
