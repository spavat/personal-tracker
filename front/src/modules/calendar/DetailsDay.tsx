import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Fragment } from "react/jsx-runtime";

import Modal from "../../components/modal";
import { formatLocalizedDate, getDurationString } from "../../utils";
import { getReadingIcons } from "../reading-book/utils";
import { getMangaPrefixName, mergeReadings } from "../reading-manga/utils";
import { dailyCalendarQuery } from "./api";

export interface DayProps {
	period: string;
	date: string;
	returnTo: string;
}

export default function DetailsDay({ date, returnTo }: DayProps) {
	const navigate = useNavigate();
	const { data } = useSuspenseQuery(dailyCalendarQuery(date));

	function closeModal() {
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}
	return (
		<>
			<Modal className="modal form dialog-large" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
				<div className="dialog-header">
					<h2 id="dialog-title">Détails du {formatLocalizedDate(date)}</h2>
				</div>
				<div className="dialog-body">
					<div className="single-panel">
						{data.show && (
							<div className="panel">
								<h3>Spectacles</h3>
								{data.show.map((item) => (
									<p key={item.id}>
										{item.name} ({item.place} à {item.time})
									</p>
								))}
							</div>
						)}

						{data.music && (
							<div className="panel">
								<h3>Musique</h3>
								{data.music.map((item) => (
									<p key={item.id}>
										{item.artist.join(", ")} - {item.album} ({getDurationString(item.duration)})
									</p>
								))}
							</div>
						)}

						{data.internet && (
							<div className="panel">
								<h3>Internet</h3>
								{data.internet.map((item) => (
									<p key={item.episodeId}>
										{item.programName} - {item.episodeName} (
										{getDurationString(item.durationReal ?? item.duration)}
										{item.durationReal ? "*" : ""})
									</p>
								))}
							</div>
						)}

						{data["reading-book"] && (
							<div className="panel">
								<h3>Livre</h3>
								{data["reading-book"].map((item) => (
									<div key={item.id}>
										<h4>{item.name}</h4>
										{item.readings.map((reading) => (
											<p key={reading.id}>
												{reading.name} (
												{getReadingIcons(reading.contextTags ?? [], { displayIcon: true })})
											</p>
										))}
									</div>
								))}
							</div>
						)}

						{data["reading-manga"] && (
							<div className="panel">
								<h3>Manga</h3>
								{data["reading-manga"].map((item) => {
									const readings = mergeReadings(item.readings as any, { sort: "asc" });
									return (
										<Fragment key={item.id}>
											{readings.map((reading) => (
												<p key={reading.id}>
													{item.name} - {getMangaPrefixName(reading)}
													{reading.name}
												</p>
											))}
										</Fragment>
									);
								})}
							</div>
						)}

						{data.game && (
							<div className="panel">
								<h3>Jeux vidéo</h3>
								{data.game.map((item) => (
									<Fragment key={item.id}>
										{item.plays.map((play) => (
											<p key={play.id}>
												{item.name} ({item.developper}) : {getDurationString(play.duration)}
											</p>
										))}
									</Fragment>
								))}
							</div>
						)}
					</div>
				</div>

				<div className="dialog-footer">
					<button type="button" onClick={closeModal}>
						Fermer
					</button>
				</div>
			</Modal>
		</>
	);
}
