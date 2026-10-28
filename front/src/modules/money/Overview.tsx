import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Fragment } from "react";

import Badge from "../../components/badge";
import { useStoredValue } from "../../hooks/stored-value";
import { banksOverviewQuery } from "./api";
import AccountBadge from "./badgeAccount";
import { normalizeZero } from "./utils";

export default function MoneyOverview() {
	const navigate = useNavigate();
	const { data: banks } = useSuspenseQuery(banksOverviewQuery());

	const [hideEmptyAccounts, setHideEmptyAccounts] = useStoredValue("money_overview_hideEmptyAccounts", true);

	function changeHideEmpty(e: React.ChangeEvent<HTMLInputElement>) {
		setHideEmptyAccounts(e.target.checked);
	}

	return (
		<>
			<h2>Vue d'ensemble</h2>
			<p>
				<label>
					<input type="checkbox" checked={hideEmptyAccounts} onChange={changeHideEmpty} /> Cacher les comptes
					vides
				</label>
			</p>
			{banks.map((bank) => {
				let accounts = bank.accounts ?? [];
				if (hideEmptyAccounts) {
					accounts = accounts.filter((account) => {
						return normalizeZero(Number(account?.history?.[0]?.amount ?? 0)) !== 0;
					});
				}
				if (accounts.length === 0) {
					// Bank ith no account with money, ignoring
					return <Fragment key={`bank-${bank.id}`}></Fragment>;
				}
				return (
					<Fragment key={`bank-${bank.id}`}>
						<h2>{bank.name}</h2>
						<div className="bank_accounts">
							{accounts?.map((account) => {
								const amount = Number(account?.history?.[0]?.amount ?? 0);
								return (
									<Fragment key={`account-${account.id}`}>
										<div>
											<AccountBadge
												name={account.name}
												color={account.textColor}
												backgroundColor={account.backgroundColor}
												amount={normalizeZero(amount).toFixed(2)}
												icon={account.icon}
												comment={account?.history?.[0]?.date}
												onClick={() =>
													navigate({
														to: "/money/transactions/$type/$id",
														params: { type: "account", id: String(account.id) },
													})
												}
												panelOpts={
													<>
														<i className="fa-solid fa-plus"></i>
														<i className="fa-regular fa-pen-to-square"></i>
														<i className="fa-regular fa-trash-can"></i>
													</>
												}
											/>
											<ul>
												{account.paymentTypes.map((paymentType) => {
													return (
														<li key={paymentType.id}>
															<Badge
																key={paymentType.id}
																name={paymentType.name}
																icon={paymentType.icon}
																backgroundColor={paymentType.backgroundColor}
																color={paymentType.textColor}
															/>
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
		</>
	);
}
