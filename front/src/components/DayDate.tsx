import { formatDate, formatDay } from "../utils";

/** A date with its day name before it; in a .cell-date cell, the dates stay aligned (see App.css .weekday). */
export default function DayDate({ date }: { date: string }) {
	return (
		<time dateTime={date}>
			<span className="weekday">{formatDay(date)}</span> {formatDate(date)}
		</time>
	);
}
