import { BookSeries } from "@personal-tracker/shared/reading-book";
import { Link } from "@tanstack/react-router";

// A series the book is in, after the series holding it, then the book's label:
// "Terre du Milieu › Le Seigneur des anneaux #1"
export default function SeriesPath({ series }: { series: BookSeries }) {
	return (
		<>
			{series.parents.map((parent) => (
				<span key={parent.id}>
					<Link to="/reading-book/series/$seriesId" params={{ seriesId: parent.id }}>
						{parent.title}
					</Link>
					{" › "}
				</span>
			))}
			<Link to="/reading-book/series/$seriesId" params={{ seriesId: series.id }}>
				{series.title}
			</Link>
			{series.positionLabel && ` #${series.positionLabel}`}
		</>
	);
}
