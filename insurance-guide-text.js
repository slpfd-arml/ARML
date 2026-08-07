/* ============================================================
   INSURANCE GUIDE TEXT
   ------------------------------------------------------------
   Source: Navigating_Health_Insurance_Options_ARM_Guide.pdf

   Formatting convention (parsed by linkifyGuideText in app.js):
     "## "   at the start of a line -> major section header
     "### "  at the start of a line -> minor section header
     "- "    at the start of a line -> bullet list item
             (consecutive bullet lines group into one list)
     blank line                     -> ends the current
                                        paragraph or list
     anything else                  -> plain body text
   Phone numbers, emails, and URLs are auto-linked wherever they
   appear - in headers, bullets, or plain lines, no markup needed.

   To update: edit the text below directly, keeping the ##/###/-
   markers where you want that structure. Plain paste of new text
   with no markers still works fine - it just renders as plain
   paragraphs, same as before this structure was added.
   ============================================================ */

const INSURANCE_GUIDE_TEXT = `
## Federal Health Insurance Programs

### Medicare
Overview:
- Federal health insurance primarily for those 65+ or younger individuals with disabilities.

Parts of Medicare:
- Part A: Hospital insurance
- Part B: Medical insurance
- Part C: Medicare Advantage (private insurance alternative)
- Part D: Prescription drug coverage

Extra Help Program:
- Assists with Medicare Part D costs for those with limited income/resources.

How to Apply:
- https://www.ssa.gov/benefits/medicare/
- Call 1-800-772-1213

### Medicaid (Medical Assistance - MA in Minnesota)
Overview:
- Health coverage for eligible low-income adults, children, pregnant women, seniors, and disabled individuals.

Eligibility:
- Based on income and household size (up to 138% FPL for adults).

How to Apply:
- https://www.mnsure.org
- Call 1-855-366-7873
- County or tribal human services office

## Minnesota State Health Programs

### MinnesotaCare
Overview:
- Health care program for low-income Minnesotans who do not qualify for MA.

Eligibility:
- Minnesota resident
- Income/asset guidelines
- Not enrolled in Medicare Parts A or B

How to Apply:
- https://www.mnsure.org
- Call 1-855-366-7873

## Hennepin County Health Programs

### Hennepin Health
Overview:
- County-based program integrating medical, behavioral health, and social services.

Eligibility:
- Hennepin County resident
- Meets MA income/asset guidelines

How to Apply:
- https://www.mnsure.org
- Call 612-596-1300

## Supplemental Insurance

### Medigap (Medicare Supplement Insurance)
- Fills gaps in Original Medicare.
- Must have Medicare A & B.
- Does not cover prescriptions (need Part D).
- Purchase from private insurance companies.

### Employer or Retiree Plans
- Often include Rx, dental, vision.

### MA & MinnesotaCare Wraparound
- Dual-eligible patients may have MSHO or SNBC plans.

### Other Supplemental Plans
- Hospital indemnity, critical illness, standalone dental/vision/hearing.

Helpful Resources:
- Senior LinkAge Line: 1-800-333-2433, https://mnaging.org
- https://www.medicare.gov
- MN Department of Commerce: https://mn.gov/commerce

## VA Health Care Benefits
Overview:
- Provided through VA Medical Centers/clinics.

Eligibility:
- Service length, discharge status, income, disability rating.

How to Enroll:
- https://www.va.gov/health-care/how-to-apply/
- Minneapolis VA: 612-725-2000
- Phone: 1-877-222-8387

VA Priority Groups:
- Determines copays, access, services covered.

VA + Other Insurance:
- Can and often should have both VA + Medicare/MA.
- VA is not creditable for Part D (unless using VA pharmacy).
- MA can cover services not provided by VA.

Special Programs:
- Dental (limited), Community Care, behavioral health, services for women veterans.

Helpful Resources:
- Hennepin County Veterans Services: 612-348-3300, https://www.hennepin.us/veterans
- MN Dept. of Veterans Affairs: https://mn.gov/mdva/

## Application Assistance

### MNsure Navigators
- Free help with MA, MinnesotaCare, other programs.
- https://www.mnsure.org/help/find-assister/index.jsp

### Community Action Partnership of Hennepin County
- In-person MNsure help: 612-348-8858, https://caphennepin.org/mnsure-assistance/

### Renewals
- Annual renewal required for Minnesota Health Care Programs.
- Report income/household changes promptly.

## Quick Tips for ARM/Community Paramedic Guidance
- Ask each patient if they served in the military.
- If yes, ask if they're enrolled in VA health care.
- Connect non-enrolled veterans to County Veterans Services.
- Educate dual-eligible patients on using both systems properly.
- Encourage low-income veterans to enroll in VA care.
- Be aware of VA Community Care referral pathways.

For more tools: contact MNsure Navigators, Senior LinkAge Line, Hennepin County Veterans Services, or local CVSO.
`;
