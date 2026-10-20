/**
 * Tax code estimation and comparison (PAYE).
 *
 * A tax code summarises how much of your income can be paid before tax.
 * The number is your total allowance divided by 10 (remainder dropped),
 * followed by a letter. 1257L = £12,570 allowance, standard.
 *
 * This only estimates the common cases. It cannot see the data HMRC holds
 * (previous employers, other income HMRC has been told about, adjustments
 * made mid-year), so a difference from HMRC's code is a prompt to check,
 * never proof that HMRC is wrong.
 */

/** "uk" means England or Northern Ireland. Wales has the same rates as England but its codes carry a C prefix. */
export type CodeRegion = "uk" | "scotland" | "wales";

export interface TaxCodeInput {
  region: CodeRegion;
  /** Personal Allowance after any taper and Marriage Allowance adjustment (the calculator already works this out). */
  allowance: number;
  receivingMarriageAllowance: boolean;
  givingMarriageAllowance: boolean;
  /** Taxable benefits in kind for the year (company car, private medical cover...). */
  benefitsInKind: number;
  /** Other untaxed income HMRC is collecting through the code. */
  untaxedIncome: number;
  /**
   * State Pension received. It is paid without tax deducted, so HMRC takes
   * the tax on it through the code of a workplace or private pension (or
   * job), by reducing the allowance on that code.
   */
  statePension?: number;
  /** Tax owed from earlier years that HMRC is collecting through the code. */
  underpaidTax: number;
  /** Rate at which the underpaid tax is converted (marginal rate, e.g. 0.2). */
  marginalRate: number;
}

export interface EstimatedTaxCode {
  code: string;
  kind: "standard" | "k" | "zero";
  /** The £ figure the code represents. For K codes this is the (positive) amount added to income. */
  amount: number;
  steps: { label: string; amount: number }[];
  notes: string[];
}

const prefixFor = (region: CodeRegion) => (region === "scotland" ? "S" : region === "wales" ? "C" : "");

export function estimateTaxCode(input: TaxCodeInput): EstimatedTaxCode {
  const underpaidAsAllowance =
    input.underpaidTax > 0 && input.marginalRate > 0
      ? Math.round(input.underpaidTax / input.marginalRate)
      : 0;

  const steps: EstimatedTaxCode["steps"] = [{ label: "Personal Allowance", amount: input.allowance }];
  if (input.benefitsInKind > 0) steps.push({ label: "Benefits in kind", amount: -input.benefitsInKind });
  if ((input.statePension ?? 0) > 0)
    steps.push({ label: "State Pension (paid without tax, collected through this code)", amount: -(input.statePension ?? 0) });
  if (input.untaxedIncome > 0) steps.push({ label: "Untaxed income collected through your code", amount: -input.untaxedIncome });
  if (underpaidAsAllowance > 0) steps.push({ label: "Underpaid tax, converted to income", amount: -underpaidAsAllowance });

  const net = steps.reduce((sum, s) => sum + s.amount, 0);
  const notes: string[] = [];
  const prefix = prefixFor(input.region);

  let suffix = "L";
  if (input.receivingMarriageAllowance) suffix = "M";
  else if (input.givingMarriageAllowance) suffix = "N";

  if (net < 0) {
    const number = Math.ceil(-net / 10);
    notes.push("The deductions are larger than your allowance, so HMRC uses a K code, which adds income instead of giving an allowance.");
    return { code: `${prefix}K${number}`, kind: "k", amount: -net, steps, notes };
  }

  if (net === 0) {
    notes.push("No allowance remains, so a 0T code applies (no allowance, tax from the first pound).");
    return { code: `${prefix}0T`, kind: "zero", amount: 0, steps, notes };
  }

  const number = Math.floor(net / 10);
  if (number === 0) {
    return { code: `${prefix}0T`, kind: "zero", amount: 0, steps, notes };
  }
  if (input.allowance < 12_570 && !input.receivingMarriageAllowance && !input.givingMarriageAllowance && input.benefitsInKind === 0 && input.untaxedIncome === 0 && !(input.statePension ?? 0) && underpaidAsAllowance === 0) {
    notes.push("Your allowance is reduced because your income is above £100,000.");
  }
  return { code: `${prefix}${number}${suffix}`, kind: "standard", amount: net, steps, notes };
}

export interface ParsedTaxCode {
  raw: string;
  prefix: "" | "S" | "C";
  kind: "standard" | "k" | "special";
  /** Digits in the code, for standard and K codes. */
  number: number | null;
  letter: string | null;
  special: string | null;
}

/**
 * Reads a code as printed on a payslip or HMRC letter. Accepts an optional
 * emergency suffix (W1, M1, X) and ignores case and spaces.
 */
export function parseTaxCode(text: string): ParsedTaxCode | null {
  const raw = text.trim().toUpperCase().replace(/\s+/g, "");
  if (!raw) return null;
  const cleaned = raw.replace(/(W1|M1|X)$/, "");
  const m =
    /^(S|C)?(?:(BR|D0|D1|NT|0T)|K(\d{1,4})|(\d{1,4})(L|M|N|T|P|V|Y))$/.exec(cleaned);
  if (!m) return null;
  const prefix = (m[1] ?? "") as ParsedTaxCode["prefix"];
  if (m[2]) return { raw, prefix, kind: "special", number: null, letter: null, special: m[2] };
  if (m[3]) return { raw, prefix, kind: "k", number: Number(m[3]), letter: "K", special: null };
  return { raw, prefix, kind: "standard", number: Number(m[4]), letter: m[5], special: null };
}

export type ComparisonStatus = "match" | "close" | "lower" | "higher" | "different" | "unreadable";

export interface TaxCodeComparison {
  status: ComparisonStatus;
  /** Signed allowance difference, entered minus estimated (negative = HMRC's code gives you less allowance). */
  allowanceDifference: number | null;
  /** Approximate yearly tax effect of that difference at the marginal rate (positive = you pay more under HMRC's code). */
  yearlyTaxEffect: number | null;
  messages: string[];
}

/** The "allowance" a code stands for, as a signed figure: K codes are negative. */
function signedAllowance(p: ParsedTaxCode): number | null {
  if (p.kind === "standard" && p.number !== null) return p.number * 10;
  if (p.kind === "k" && p.number !== null) return -p.number * 10;
  return null;
}

export function compareTaxCodes(
  entered: string,
  estimated: EstimatedTaxCode,
  region: CodeRegion,
  marginalRate: number
): TaxCodeComparison {
  const parsed = parseTaxCode(entered);
  if (!parsed) {
    return {
      status: "unreadable",
      allowanceDifference: null,
      yearlyTaxEffect: null,
      messages: [
        "We couldn't read that as a tax code. Codes look like 1257L, S1257L, K475 or BR. Check your payslip or HMRC letter.",
      ],
    };
  }

  const messages: string[] = [];

  if (parsed.kind === "special") {
    const meaning: Record<string, string> = {
      BR: "all income taxed at the basic rate with no allowance, which is normal for a second job or pension",
      D0: "all income taxed at the higher rate with no allowance",
      D1: "all income taxed at the additional rate with no allowance",
      NT: "no tax deducted",
      "0T": "no allowance, with tax from the first pound",
    };
    messages.push(
      `${parsed.special} means ${meaning[parsed.special as string]}. That is a valid code, but it is not comparable with the single-allowance estimate of ${estimated.code}.`
    );
    if (parsed.special === "BR" || parsed.special === "D0" || parsed.special === "D1") {
      messages.push("These codes are normally used for a second job or pension. Your main income should carry the allowance, so check that the allowance is not being used twice, or not at all.");
    }
    return { status: "different", allowanceDifference: null, yearlyTaxEffect: null, messages };
  }

  const expectedPrefix = prefixFor(region);
  let prefixMismatch = false;
  if (parsed.prefix !== expectedPrefix) {
    prefixMismatch = true;
    const regionName = region === "scotland" ? "Scotland" : region === "wales" ? "Wales" : "England or Northern Ireland";
    messages.push(
      expectedPrefix
        ? `Your code has ${parsed.prefix ? "a " + parsed.prefix + " prefix" : "no prefix"}, but you chose ${regionName}, where codes start with ${expectedPrefix}. Check that the region above is right.`
        : `Your code starts with ${parsed.prefix} (${parsed.prefix === "S" ? "Scottish" : "Welsh"} income tax), but you chose ${regionName}, where codes have no prefix. Check that the region above is right.`
    );
  }

  const enteredAllowance = signedAllowance(parsed);
  const estimatedAllowance = estimated.kind === "k" ? -estimated.amount : estimated.amount;
  if (enteredAllowance === null) {
    return { status: "unreadable", allowanceDifference: null, yearlyTaxEffect: null, messages };
  }

  const diff = enteredAllowance - estimatedAllowance;
  const yearlyTaxEffect = Math.round(-diff * marginalRate);

  if (parsed.letter && ["M", "N"].includes(parsed.letter) && estimated.code.slice(-1) !== parsed.letter) {
    messages.push(
      parsed.letter === "M"
        ? "Your code ends in M, which means you are receiving Marriage Allowance, but you haven't ticked that box above."
        : "Your code ends in N, which means you have transferred Marriage Allowance to a partner, but you haven't ticked that box above."
    );
  }
  if (estimated.code.slice(-1) === "M" && parsed.letter === "L") {
    messages.push("You are receiving Marriage Allowance but your code ends in L. It may not have been added to your code yet. You can ask HMRC to update it.");
  }
  if (estimated.code.slice(-1) === "N" && parsed.letter === "L") {
    messages.push("You are giving Marriage Allowance but your code ends in L. It may not have been added to your code yet.");
  }

  // One step in the number is £10 of allowance, worth £2 of tax at 20%.
  // That is the rounding noise this estimate can't resolve.
  if (diff === 0) {
    messages.push("Your code matches our estimate.");
    return { status: prefixMismatch ? "different" : "match", allowanceDifference: 0, yearlyTaxEffect: 0, messages };
  }
  if (Math.abs(diff) <= 10) {
    messages.push("Your code is within one step of our estimate, which is down to rounding.");
    return { status: prefixMismatch ? "different" : "close", allowanceDifference: diff, yearlyTaxEffect, messages };
  }

  const abs = Math.abs(diff).toLocaleString("en-GB");
  const taxAbs = Math.abs(yearlyTaxEffect).toLocaleString("en-GB");
  if (diff < 0) {
    messages.push(
      `Your code gives you £${abs} less allowance than we estimate, which would cost you about £${taxAbs} a year in extra tax.`
    );
    messages.push(
      "Common reasons: a benefit in kind (such as a company car or private medical insurance), tax underpaid in an earlier year, untaxed income HMRC is collecting through your code, or an estimate of income higher than yours. Add any of these above to see whether they explain the gap."
    );
    return { status: "lower", allowanceDifference: diff, yearlyTaxEffect, messages };
  }
  messages.push(
    `Your code gives you £${abs} more allowance than we estimate, which would mean about £${taxAbs} less tax collected in the year.`
  );
  messages.push(
    "Common reasons: HMRC doesn't know about some of your income or benefits yet, or it has applied an allowance (such as Marriage Allowance) that you haven't entered. If your income has risen, you may owe tax later, so it's worth checking."
  );
  return { status: "higher", allowanceDifference: diff, yearlyTaxEffect, messages };
}
