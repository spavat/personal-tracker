import { useSuspenseQuery } from "@tanstack/react-query";
import { Fragment, useOptimistic, useTransition } from "react";

import { PendingContent } from "../../components/pending-content";
import { useStoredValue } from "../../hooks/stored-value";
import { analyticsQuery, SPLIT_PARENT_STORAGE } from "./api";
import AccountBadge from "./badgeAccount";
import { normalizeZero } from "./utils";

export default function MoneyAnalytics() {
	const [splitParent, setSplitParent] = useStoredValue(SPLIT_PARENT_STORAGE.key, SPLIT_PARENT_STORAGE.defaultValue);
	const [isPending, startTransition] = useTransition();
	const [optimisticSplitParent, setOptimisticSplitParent] = useOptimistic(splitParent);
	const { data } = useSuspenseQuery(analyticsQuery(splitParent));

	function changeSplitParent(e: React.ChangeEvent<HTMLInputElement>) {
		// transition: keep the current analytics displayed while the new split loads
		const checked = e.target.checked;
		startTransition(() => {
			setOptimisticSplitParent(checked);
			setSplitParent(checked);
		});
	}

	return (
		<>
			<h2>Analytique</h2>
			<p>
				<label>
					<input type="checkbox" checked={optimisticSplitParent} onChange={changeSplitParent} /> Séparer par
					années
				</label>
			</p>
			<PendingContent isPending={isPending}>
				{data.map((parent) => {
					if (parent.badges.length === 0) {
						// Bank ith no account with money, ignoring
						return <></>;
					}

					return (
						<Fragment key={`tag-${parent.name}`}>
							<h2>{parent.name}</h2>
							<div className="bank_accounts">
								{parent.badges.map((badge) => {
									return (
										<Fragment key={badge.name}>
											<div>
												<AccountBadge
													name={badge.name}
													color={badge.textColor}
													backgroundColor={badge.backgroundColor}
													amount={normalizeZero(badge.amount).toFixed(2)}
													icon={badge.icon}
													comment={badge.comment}
													// onClick={() => navigate(`/money/transactions/account/${account.id}`)}
													panelOpts={<></>}
												/>
												<ul>
													{badge.parts.map(({ name, amount, comment }) => {
														return (
															<li key={name}>
																<span className="monospace">{name}</span> :{" "}
																<b>{amount.toFixed(2)} €</b> ({comment})
															</li>
														);
													})}
												</ul>
											</div>
										</Fragment>
									);
								})}
							</div>
						</Fragment>
					);
				})}
			</PendingContent>
		</>
	);
}
