import type { ProgramDetails } from "@personal-tracker/shared/broadcast";

import { useLocation, useNavigate } from "@tanstack/react-router";

import TagBadge from "../../../../components/TagBadge";
import { API_BASE_URL } from "../../../../config";
import { useIsOwner } from "../../../../hooks/use-is-owner";
import { formatDate, getDurationString, getPeriodDifference } from "../../../../utils";
import { getDomain } from "../../links";
import { getIconType } from "../../search-fn";

// The program's banner, presentation and stats
export default function ProgramHeader({ program }: { program: ProgramDetails }) {
	const isOwner = useIsOwner();
	const navigate = useNavigate();
	const location = useLocation();
	const isCatalog = program.tracking === "catalog";

	return (
		<>
			{program.banner && <img src={`${API_BASE_URL}${program.banner}`} alt="" className="program-banner" />}
			<div className="presentation">
				<div className="title">
					<h2>
						{program.name}
						{program.shortName && <span className="subTitle"> ({program.shortName})</span>}
						{isOwner && (
							<button
								type="button"
								title="Modifier"
								onClick={() =>
									navigate({
										to: "/broadcast/$programId/edit",
										params: { programId: program.id },
										search: { returnTo: location.pathname },
										replace: true,
										resetScroll: false,
										mask: { to: "/broadcast/$programId", params: { programId: program.id } },
									})
								}
							>
								<i className="fa-regular fa-pen-to-square"></i>
							</button>
						)}
					</h2>
				</div>

				<div className="general">
					{program.profile && (
						<div className="profile">
							<img
								src={`${API_BASE_URL}${program.profile}`}
								alt=""
								className="program-profile"
								style={{ viewTransitionName: `program-profile-${program.id}` }}
							/>
						</div>
					)}
					<div>
						{program.author && (
							<>
								<span>
									par : <b>{program.author}</b>
								</span>
								<br />
							</>
						)}
						{program.network && (
							<>
								<span>
									Réseau : <b>{program.network}</b>
								</span>
								<br />
							</>
						)}
						{program.country && (
							<>
								<span>
									Pays : <span className={`fi fi-${program.country}`}></span>
								</span>
								<br />
							</>
						)}
						{program.type && (
							<>
								<span>
									Type : {getIconType(program)}&nbsp;
									{program.type}
								</span>
								<br />
							</>
						)}
						{(program.links ?? []).length > 0 && (
							<>
								<span>
									Liens:{" "}
									{program.links?.map((l) => {
										return (
											<a key={l} href={l}>
												{getDomain(l)}
											</a>
										);
									})}
								</span>
								<br />
							</>
						)}
						{(program.tags ?? []).length > 0 && (
							<>
								<span>
									Tags :{" "}
									{program.tags?.map((t) => (
										<TagBadge key={t} name={t} />
									))}
								</span>
							</>
						)}
					</div>
				</div>
				<div className="description">{program.description && <>{program.description}</>}</div>
				<div className="stats">
					<div>
						{isCatalog && (
							<>
								<span>
									<i className="fa-solid fa-eye"></i> <strong>{program.details.watched}</strong> /{" "}
									{program.details.releases - program.details.skipped} vus{" "}
									<progress
										value={program.details.watched}
										max={program.details.releases - program.details.skipped || 1}
										aria-label="Progression"
									></progress>
									{program.details.skipped > 0 && <> ({program.details.skipped} ignoré(s))</>}
								</span>
								<br />
							</>
						)}
						<span>
							<i className="fa-solid fa-list"></i> <strong>{program.details.episodes}</strong> épisodes
						</span>
						<br />
						<span>
							<i className="fa-solid fa-clock"></i> Durée moyenne :{" "}
							<strong>{getDurationString(program.details.averageLength)}</strong>
						</span>
						<br />
						<span>
							<i className="fa-solid fa-check"></i> Taux de complétion :{" "}
							<strong>{program.details.completionRate}%</strong>
						</span>
						<br />
						<span>
							<i className="fa-solid fa-calendar"></i> Dernier épisode :{" "}
							<strong>
								{getPeriodDifference(program.details.lastSeenDate)} (
								<strong>{formatDate(program.details.lastSeenDate)}</strong>)
							</strong>
						</span>
						<br />
					</div>
				</div>
			</div>
		</>
	);
}
