import { useSuspenseQuery } from "@tanstack/react-query";

import Badge from "../../../components/badge";
import { formatDate, formatDay } from "../../../utils";
import { transactionQuery } from "../api";
import { getAmountClassName } from "../utils";

function EntityBadge({ entity }: { entity?: Money.Category | Money.PaymentType | Money.Tag }) {
	if (!entity) {
		return null;
	}
	return (
		<Badge
			name={entity.name}
			icon={entity.icon}
			backgroundColor={entity.backgroundColor}
			color={entity.textColor}
		/>
	);
}

export default function TransactionDetails({ transactionId }: { transactionId: number }) {
	const { data: transaction } = useSuspenseQuery(transactionQuery(transactionId));

	return (
		<>
			<div className="presentation">
				<div className="title">
					<h2>
						{Boolean(transaction.recurrent) && (
							<>
								<i className="fa-solid fa-rotate"></i>&nbsp;
							</>
						)}
						{transaction.name}{" "}
						{transaction.description && <span className="subTitle">({transaction.description})</span>}
					</h2>
				</div>

				<div className="general">
					<div>
						<span>
							Date :{" "}
							<b>
								{formatDay(transaction.date)} {formatDate(transaction.date)}
							</b>
						</span>
						<br />
						{transaction.considerationDate && (
							<>
								<span>
									Date de prise en compte : <b>{formatDate(transaction.considerationDate)}</b>
								</span>
								<br />
							</>
						)}
						{transaction.category && (
							<>
								<span>
									Catégorie : <EntityBadge entity={transaction.category} />
								</span>
								<br />
							</>
						)}
						{transaction.paymentType && (
							<>
								<span>
									Moyen de paiement : <EntityBadge entity={transaction.paymentType} />
								</span>
								<br />
							</>
						)}
					</div>
				</div>
				<div className="description"></div>
				<div className="stats">
					<div>
						<span>
							<i className="fa-solid fa-euro-sign"></i> Montant :{" "}
							<strong className={getAmountClassName(transaction.amount, transaction)}>
								{transaction.amount}&nbsp;€
							</strong>
						</span>
						<br />
						{Boolean(transaction.informative) && (
							<>
								<span>
									<i className="fa-solid fa-circle-info"></i> Informative
								</span>
								<br />
							</>
						)}
						{(transaction.tags ?? []).length > 0 && (
							<span>
								Tags :{" "}
								{transaction.tags.map((t) => (
									<EntityBadge key={t.id} entity={t} />
								))}
							</span>
						)}
					</div>
				</div>
			</div>

			{transaction.comment && (
				<div className="comment">
					<h3>Commentaire</h3>
					<p>{transaction.comment}</p>
				</div>
			)}

			{(transaction.children ?? []).length > 0 && (
				<>
					<h3>Transactions enfants</h3>
					<table className="list transactions alternate">
						<thead>
							<tr>
								<th>Nom</th>
								<th>Montant</th>
								<th>Catégorie</th>
								<th>Paiement</th>
								<th>Tags</th>
							</tr>
						</thead>
						<tbody>
							{transaction.children.map((child) => (
								<tr key={child.id}>
									<td>
										{child.name}
										{child.description && (
											<span className="description"> - {child.description}</span>
										)}
									</td>
									<td className={getAmountClassName(child.amount, transaction)}>
										{child.amount}&nbsp;€
									</td>
									<td>
										<EntityBadge entity={child.category} />
									</td>
									<td>
										<EntityBadge entity={child.paymentType} />
									</td>
									<td>
										{(child.tags ?? []).map((t) => (
											<EntityBadge key={t.id} entity={t} />
										))}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</>
			)}
		</>
	);
}
