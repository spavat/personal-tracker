import { Link } from "@tanstack/react-router";

import { HeaderPortal } from "../../../components/HeaderPortal";
import PeriodSelector from "../../../components/period-selector";
import { formatMonth } from "../../../utils";

export default function TransactionsHeader({
	searchActive,
	search,
	from,
	to,
	basePeriod,
	showTags,
	useTransactionDate,
	goPrevious,
	goNext,
	canGoPrevious,
	canGoNext,
	onChangeShowTags,
	onChangeUseTransactionDate,
}: {
	searchActive: boolean;
	search?: string;
	from: string;
	to: string;
	basePeriod: string;
	showTags: boolean;
	useTransactionDate: boolean;
	goPrevious: () => void;
	goNext: () => void;
	canGoPrevious: () => boolean;
	canGoNext: () => boolean;
	onChangeShowTags: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onChangeUseTransactionDate: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
	return (
		<>
			<h2>
				{searchActive ? (
					<>
						{`Recherche "${search ?? ""}" (${from} - ${to})`}
						<Link to={"/money/transactions"}>
							<i className="fa-solid fa-ban"></i>
						</Link>
					</>
				) : (
					<HeaderPortal>
						<PeriodSelector
							period={formatMonth(`${basePeriod}-01`)}
							goPrevious={goPrevious}
							goNext={goNext}
							canGoPrevious={canGoPrevious()}
							canGoNext={canGoNext()}
							type="month"
						/>
					</HeaderPortal>
				)}
			</h2>
			<p>
				<label>
					<input type="checkbox" checked={useTransactionDate} onChange={onChangeUseTransactionDate} /> Date de
					transaction
				</label>{" "}
				-
				<label>
					<input type="checkbox" checked={showTags} onChange={onChangeShowTags} /> Afficher les tags
				</label>
			</p>
		</>
	);
}
