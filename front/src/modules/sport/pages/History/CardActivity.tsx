import { SportActivity } from "@personal-tracker/shared/sport";
import { Link } from "@tanstack/react-router";

import { formatFullDate, getDurationString } from "../../../../utils";
import { getActivityThumbnailUrl } from "../../api";
import { formatPaceMinPerKm, getActivityTypeLabel } from "../../utils";

export default function CardActivity({ activity }: { activity: SportActivity }) {
	return (
		<div className="card_item">
			<span className="title">
				<Link to="/sport/$activityId" params={{ activityId: activity.id }}>
					{activity.name}
				</Link>
			</span>{" "}
			- <span className="subtitle">{getActivityTypeLabel(activity.type)}</span>
			{activity.thumbnailKey && (
				<Link to="/sport/$activityId" params={{ activityId: activity.id }}>
					<img className="activity-thumbnail" src={getActivityThumbnailUrl(activity.id)} alt="" />
				</Link>
			)}
			<div className="activity-stats">
				📅 {formatFullDate(activity.date)}&nbsp;
				<span>📏 {activity.details.distance} km</span>&nbsp;
				<span>⏱️ {getDurationString(activity.details.totalDuration) || "0min"}</span>&nbsp;
				<span>🏃 {formatPaceMinPerKm(activity.details.pace)} /km</span>
			</div>
		</div>
	);
}
