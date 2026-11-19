interface AmountOption {
	informative?: boolean | null;
}
// a transaction saved without an amount counts as 0
export function getAmountClassName(amount: number | null, options?: AmountOption) {
	if (options?.informative) {
		return "informative";
	}
	if (amount === null) {
		return "transfert";
	} else if (amount < 0) {
		return "debit";
	} else if (amount > 0) {
		return "credit";
	} else {
		return "transfert";
	}
}

export function formatAmount(amount: number) {
	return amount.toFixed(2) + " €";
}

export function normalizeZero(n: number, epsilon = 1e-12) {
	return Math.abs(n) < epsilon ? 0 : n;
}
