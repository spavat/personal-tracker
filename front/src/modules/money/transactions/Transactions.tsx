import { useSuspenseQueries } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useOptimistic, useTransition } from "react";

import { PendingContent } from "../../../components/pending-content";
import { useStoredValue } from "../../../hooks/stored-value";
import { useMonthNavigation } from "../../../hooks/use-month-changer";
import {
	categoriesQuery,
	monthRange,
	paymentTypesQuery,
	transactionsQuery,
	USE_TRANSACTION_DATE_STORAGE,
} from "../api";
import PeriodNavigation from "./PeriodNavigation";
import TransactionsHeader from "./TransactionsHeader";
import TransactionsTable from "./TransactionsTable";

export default function MoneyTransactions({
	period,
	search,
	from,
	to,
}: {
	period?: string;
	search?: string;
	from?: string;
	to?: string;
}) {
	const navigate = useNavigate();
	const location = useLocation();
	const basePeriod = period ?? Temporal.Now.plainDateISO().toPlainYearMonth().toString();

	const [goPrevious, goNext, canGoPrevious, canGoNext] = useMonthNavigation({
		navigationIsDisabled: (period: string, delta: "previous" | "next") => {
			if (delta === "next" && period >= Temporal.Now.plainDateISO().toPlainYearMonth().toString()) {
				return true;
			} else if (delta === "previous" && period <= "2017-01") {
				return true;
			}
			return false;
		},
		period: basePeriod,
	});

	const [showTags, setShowTags] = useStoredValue("money_transactions_showTags", false);
	const [useTransactionDate, setUseTransactionDate] = useStoredValue(
		USE_TRANSACTION_DATE_STORAGE.key,
		USE_TRANSACTION_DATE_STORAGE.defaultValue,
	);
	const [isPending, startTransition] = useTransition();
	const [optimisticUseTransactionDate, setOptimisticUseTransactionDate] = useOptimistic(useTransactionDate);
	function changeShowTags(e: React.ChangeEvent<HTMLInputElement>) {
		setShowTags(e.target.checked);
	}

	const searchActive = Boolean(search || from || to);

	if (!searchActive) {
		({ from, to } = monthRange(basePeriod));
	} else {
		from = from ?? "";
		to = to ?? "";
	}

	// parallel: three separate useSuspenseQuery calls would load one after the other
	const [transactions, categories, paymentTypes] = useSuspenseQueries({
		queries: [transactionsQuery(from, to, search, useTransactionDate), categoriesQuery(), paymentTypesQuery()],
	});

	function changeUseTransactionDate(event: React.ChangeEvent<HTMLInputElement>) {
		// transition: keep the current transactions displayed while the new order loads
		const checked = event.target.checked;
		startTransition(() => {
			setOptimisticUseTransactionDate(checked);
			setUseTransactionDate(checked);
		});
	}

	return (
		<>
			<TransactionsHeader
				searchActive={searchActive}
				search={search}
				from={from}
				to={to}
				basePeriod={basePeriod}
				goPrevious={goPrevious}
				goNext={goNext}
				canGoPrevious={canGoPrevious}
				canGoNext={canGoNext}
				showTags={showTags}
				onChangeShowTags={changeShowTags}
				useTransactionDate={optimisticUseTransactionDate}
				onChangeUseTransactionDate={changeUseTransactionDate}
			/>
			{!searchActive && <PeriodNavigation basePeriod={basePeriod} />}
			<PendingContent isPending={isPending}>
				<TransactionsTable
					transactions={transactions.data}
					categories={categories.data}
					paymentTypes={paymentTypes.data}
					showTags={showTags}
					period={period}
					from={from}
					to={to}
				/>
			</PendingContent>

			<div className="fab-container">
				<button
					type="button"
					className="fab-main"
					title="Ajouter une transaction"
					onClick={() =>
						navigate({
							to: "/money/transactions/$period/transaction/add",
							params: { period: basePeriod },
							search: { returnTo: location.pathname },
							replace: true,
							resetScroll: false,
							mask: {
								to: "/money/transactions/$period",
								params: { period: basePeriod },
							},
						})
					}
				>
					<div className="pulse"></div>
					<div className="heart-line">
						<i className="fa-solid fa-plus"></i>
					</div>
				</button>
			</div>
			<Outlet />
		</>
	);
}
