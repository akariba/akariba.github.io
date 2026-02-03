1. Problem Statement

As part of the Credit Stream implementation, accrued interest needs to be produced as a separate risk output from Sabre.

Historically, accrued interest for relevant products has been sourced from Murex. Accounting is now transitioning this source from Murex to Sabre. Before this transition can be completed, PC validation and formal sign-off are required to confirm that the Sabre outputs are acceptable for accounting consumption.

This dependency is currently blocking progress on the Credit Stream, hence the alignment discussion.

2. Purpose of the Accrued Interest Output

The accrued interest output is not intended for trading P&L.

It is required solely for accounting purposes, specifically to:

Support accounting postings and sub-ledger treatment

Meet accounting policy requirements for certain portfolios

Accounting currently consumes accrued interest from Murex and plans to replace Murex with Sabre as the strategic source.

3. Products in Scope

Previously implemented and signed off by PC:

Loans and Deposits

Interest Rate Swaps (IRS)

Credit Default Swaps (CDS)

New scope under the Credit Stream:

Credit products booked in Credit books for which Accounting requires accrued interest

4. Key Discussion Points
4.1 Nature of the Accrued Interest Output

Accrued interest is a standalone risk scenario.

It is reported separately from PV / MTM.

It is consumed by Accounting, not by Front Office or Trading P&L.

4.2 Validation Approach

Historically, PC has validated accrued interest by benchmarking Sabre outputs against Murex.

Exact numerical alignment with Murex is not mandatory, provided:

The methodology is sound

Differences are understood, explainable, and documented

The same validation approach is being followed for Credit products for governance consistency.

5. Question Raised on PV Sufficiency (Venkata)

Venkata raised a question on why a separate accrued interest output is required, highlighting that:

Derivatives are fair-valued instruments

PV already incorporates accrued interest

From a valuation / FVTPL perspective, PV alone should theoretically be sufficient

Response / Clarification:

While PV is sufficient from a pure valuation perspective, the need for a separate accrued interest output is driven by:

Accounting policies

Sub-ledger and posting requirements

Portfolio-specific or policy-driven accounting treatments

In such cases, Accounting requires accrued interest to be extracted and consumed separately, even for derivative products.

This requirement is driven by accounting policy, not valuation methodology.

Final confirmation on the accounting rationale sits with the Accounting team (Jessica and team).

6. Stakeholders

Risk / Sabre Team – Producing the accrued interest risk output

Product Control (PC) – Validation and formal sign-off

Accounting (Jessica & team) – Defining accounting treatment and consumption

Credit Stream / Project Team – Dependent on sign-off to proceed

7. Conclusions

Accrued interest remains in scope for the Credit Stream.

Sabre is the target source system.

Murex is used only as a validation benchmark.

PC sign-off is mandatory prior to completing the source switch.

Accounting clarification is required to support final validation.

8. Next Steps

Accounting Confirmation

Engage Jessica and team to confirm:

Accounting rationale

Applicable Credit products and portfolios

Policy expectations for accrued interest

Validation

Perform Sabre vs Murex reconciliation for accrued interest

Document and explain any differences

PC Sign-off

Share reconciliation results and accounting confirmation with PC

Address any follow-ups and obtain formal sign-off

Unblock Credit Stream

Enable accrued interest risk output in Sabre for Credit books

Proceed with Credit Stream implementation
