export function CastingIcon({ casting_status, casting_origin }: { casting_status: string; casting_origin: string }) {
	if (casting_status === "tbd") {
		return (
			<span className="icon-badge-wrap">
				<i className="fa-solid fa-hourglass-half" style={{ color: "gray" }}></i>
			</span>
		);
	}
	if (casting_status === "unknown") {
		return (
			<span className="icon-badge-wrap">
				<i className="fa-solid fa-question-circle"></i>
			</span>
		);
	}
	if (casting_status === "partial") {
		return (
			<span className="icon-badge-wrap">
				<i className="fa-solid fa-user"></i>
				{casting_origin === "performance" && <i className="fa-solid fa-circle-check icon-badge lightgreen"></i>}
				{casting_origin === "program" && <i className="fa-solid fa-book-open icon-badge pink"></i>}
			</span>
		);
	}
	if (casting_status === "complete") {
		return (
			<span className="icon-badge-wrap">
				<i className="fa-solid fa-people-group"></i>
				{casting_origin === "performance" && <i className="fa-solid fa-circle-check icon-badge lightgreen"></i>}
				{casting_origin === "program" && <i className="fa-solid fa-book-open icon-badge pink"></i>}
			</span>
		);
	}
	return null;
}
