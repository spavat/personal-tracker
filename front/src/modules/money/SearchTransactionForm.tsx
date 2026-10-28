import { useNavigate } from "@tanstack/react-router";
import { type SubmitHandler, useForm } from "react-hook-form";

import Modal from "../../components/modal";

interface Inputs {
	search: string;
	from: string | null;
	to: string | null;
}

type SearchStaticProps = {
	isOpen: boolean;
	onClose: () => void;
};

export default function SearchTransactionForm({ isOpen, onClose }: SearchStaticProps) {
	const navigate = useNavigate();

	const today = Temporal.Now.plainDateISO();

	const { register, reset, handleSubmit, setValue } = useForm<Inputs>({
		defaultValues: {
			from: today.subtract({ years: 1 }).toString(),
			to: today.toString(),
		},
	});

	const onSubmit: SubmitHandler<Inputs> = async (data) => {
		const fields: any = {};
		if (data.search) {
			fields.search = data.search;
		}
		if (data.from) {
			fields.from = data.from;
		}
		if (data.to) {
			fields.to = data.to;
		}
		navigate({
			to: "/money/transactions/search",
			search: fields,
		});
		closeModal();
	};

	function closeModal() {
		reset();
		onClose();
	}

	function changePreset(type: "rollingYear" | "currentYear" | "startOfLastYear" | "all") {
		switch (type) {
			case "rollingYear":
				setValue("from", today.subtract({ years: 1 }).toString());
				setValue("to", today.toString());
				break;
			case "currentYear":
				setValue("from", today.with({ day: 1, month: 1 }).toString());
				setValue("to", today.with({ day: 31, month: 12 }).toString());
				break;
			case "startOfLastYear":
				setValue("from", today.subtract({ years: 1 }).with({ day: 1, month: 1 }).toString());
				setValue("to", today.toString());
				break;
			default:
				setValue("from", null);
				setValue("to", null);
		}
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<Modal className="search form dialog-medium" isOpen={isOpen} onClose={closeModal} hasCloseBtn={false}>
				<div className="input">
					<label htmlFor="search" aria-label="Recherche">
						<i className="fa-solid fa-magnifying-glass"></i>
						<input type="text" {...register("search")} placeholder="Recherche" />
					</label>
					<button
						type="button"
						className="invisible-button badge-remove"
						aria-label="Close"
						onClick={closeModal}
					>
						<i className="fa-solid fa-close"></i>
					</button>
					{/* <a role="button" onClick={closeModal}>
						<i className="fa-solid fa-close"></i>
					</a> */}
				</div>

				<div className="options single-panel">
					<div className="panel">
						<h3>Options de recherche</h3>
						<div className="form-grid">
							<label className="form-field">
								<span>Date de début</span>
								<input type="date" {...register("from")} />
							</label>
							<label className="form-field">
								<span>Date de fin</span>
								<input type="date" {...register("to")} />
							</label>
							<div className="form-field full-width">
								<p>
									<button type="button" onClick={() => changePreset("rollingYear")}>
										Annéee glissante
									</button>{" "}
									<button type="button" onClick={() => changePreset("currentYear")}>
										Annéee courante
									</button>{" "}
									<button type="button" onClick={() => changePreset("startOfLastYear")}>
										Début de l'année derniere
									</button>{" "}
									<button type="button" onClick={() => changePreset("all")}>
										Pas de restriction
									</button>
								</p>
							</div>
						</div>
					</div>
				</div>

				<div className="footer">
					<div className="dialog-footer">
						<button type="button" onClick={closeModal}>
							Annuler
						</button>
						<button type="submit" className="main">
							Rechercher
						</button>
					</div>
				</div>
			</Modal>
		</form>
	);
}
