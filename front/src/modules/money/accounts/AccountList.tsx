import { useSuspenseQuery } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import Badge from "../../../components/badge";
import { banksTreeQuery } from "../api";

export default function AccountList() {
	const navigate = useNavigate();
	const location = useLocation();

	const { data: banks } = useSuspenseQuery(banksTreeQuery());

	return (
		<>
			<h2>Configuration des comptes</h2>

			<ul className="tree">
				{banks.map((bank) => (
					<li key={bank.id}>
						<div>
							<summary>
								<b>{bank.name}</b> -{" "}
								<button
									type="button"
									title="Modifier"
									onClick={() =>
										navigate({
											to: "/money/accounts/bank/$bankId/edit",
											params: { bankId: String(bank.id) },
											search: { returnTo: location.pathname },
											replace: true,
											resetScroll: false,
											mask: { to: "/money/accounts" },
										})
									}
								>
									<i className="fa-regular fa-pen-to-square"></i>
								</button>{" "}
								<button
									type="button"
									title="Supprimer"
									onClick={() =>
										navigate({
											to: "/money/accounts/bank/$bankId/delete",
											params: { bankId: String(bank.id) },
											search: { returnTo: location.pathname },
											replace: true,
											resetScroll: false,
											mask: { to: "/money/accounts" },
										})
									}
								>
									<i className="fa-regular fa-trash-can"></i>
								</button>
							</summary>
							<ul>
								{bank.accounts.map((account) => (
									<li key={account.id}>
										<div>
											<summary>
												{account.name} -{" "}
												<button
													type="button"
													title="Modifier"
													onClick={() =>
														navigate({
															to: "/money/accounts/account/$accountId/edit",
															params: { accountId: String(account.id) },
															search: { returnTo: location.pathname },
															replace: true,
															resetScroll: false,
															mask: { to: "/money/accounts" },
														})
													}
												>
													<i className="fa-regular fa-pen-to-square"></i>
												</button>{" "}
												<button
													type="button"
													title="Supprimer"
													onClick={() =>
														navigate({
															to: "/money/accounts/account/$accountId/delete",
															params: { accountId: String(account.id) },
															search: { returnTo: location.pathname },
															replace: true,
															resetScroll: false,
															mask: { to: "/money/accounts" },
														})
													}
												>
													<i className="fa-regular fa-trash-can"></i>
												</button>
											</summary>
											<ul>
												{account.paymentTypes.map((paymentType) => (
													<li key={paymentType.id}>
														{paymentType.name} /{" "}
														<Badge
															key={paymentType.id}
															name={paymentType.name}
															icon={paymentType.icon}
															backgroundColor={paymentType.backgroundColor}
															color={paymentType.textColor}
														/>
														-{" "}
														<button
															type="button"
															title="Modifier"
															onClick={() =>
																navigate({
																	to: "/money/accounts/paymentType/$paymentTypeId/edit",
																	params: { paymentTypeId: String(paymentType.id) },
																	search: { returnTo: location.pathname },
																	replace: true,
																	resetScroll: false,
																	mask: { to: "/money/accounts" },
																})
															}
														>
															<i className="fa-regular fa-pen-to-square"></i>
														</button>{" "}
														<button
															type="button"
															title="Supprimer"
															onClick={() =>
																navigate({
																	to: "/money/accounts/paymentType/$paymentTypeId/delete",
																	params: { paymentTypeId: String(paymentType.id) },
																	search: { returnTo: location.pathname },
																	replace: true,
																	resetScroll: false,
																	mask: { to: "/money/accounts" },
																})
															}
														>
															<i className="fa-regular fa-trash-can"></i>
														</button>
													</li>
												))}
											</ul>
										</div>
									</li>
								))}
							</ul>
						</div>
					</li>
				))}
			</ul>
			<div className="fab-container">
				<button
					type="button"
					className="fab-main"
					title="Ajouter un type de paiement"
					onClick={() =>
						navigate({
							to: "/money/accounts/paymentType/add",
							search: { returnTo: location.pathname },
							replace: true,
							resetScroll: false,
							mask: { to: "/money/accounts" },
						})
					}
				>
					<div className="pulse"></div>
					<div className="heart-line">
						<i className="fa-solid fa-credit-card"></i>
					</div>
				</button>
				<button
					type="button"
					className="fab-main"
					title="Ajouter un compte"
					onClick={() =>
						navigate({
							to: "/money/accounts/account/add",
							search: { returnTo: location.pathname },
							replace: true,
							resetScroll: false,
							mask: { to: "/money/accounts" },
						})
					}
				>
					<div className="pulse"></div>
					<div className="heart-line">
						<i className="fa-solid fa-table-list"></i>
					</div>
				</button>
				<button
					type="button"
					className="fab-main"
					title="Ajouter une banque"
					onClick={() =>
						navigate({
							to: "/money/accounts/bank/add",
							search: { returnTo: location.pathname },
							replace: true,
							resetScroll: false,
							mask: { to: "/money/accounts" },
						})
					}
				>
					<div className="pulse"></div>
					<div className="heart-line">
						<i className="fa-solid fa-building-columns"></i>
					</div>
				</button>
			</div>

			<Outlet />
		</>
	);
}

// https://blog.shevarezo.fr/post/2023/01/10/creer-arborescence-css-uniquement
