export function getMonthsBetween({ from, to }: { from: string; to: string }) {
	const start = Temporal.PlainYearMonth.from(from);
	const end = Temporal.PlainYearMonth.from(to);

	const months = [];
	let current = start;

	while (Temporal.PlainYearMonth.compare(current, end) <= 0) {
		months.push(current.toString());
		current = current.add({ months: 1 });
	}

	return months;
}
