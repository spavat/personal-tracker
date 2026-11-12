import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import Modal from "../../../components/Modal";
import MutationError from "../../../components/MutationError";
import { aspspsQuery, startBankConnection } from "../api";

const COUNTRIES = [
	{ code: "FR", label: "France" },
	{ code: "BE", label: "Belgique" },
	{ code: "DE", label: "Allemagne" },
	{ code: "ES", label: "Espagne" },
	{ code: "IT", label: "Italie" },
	{ code: "LU", label: "Luxembourg" },
	{ code: "NL", label: "Pays-Bas" },
	// sandbox "Mock ASPSP"
	{ code: "FI", label: "Finlande" },
];

export default function AddBankConnectionForm({ returnTo }: { returnTo: string }) {
	const navigate = useNavigate();
	const [country, setCountry] = useState("FR");
	const [aspspName, setAspspName] = useState("");
	const aspsps = useQuery(aspspsQuery(country));
	const startMutation = useMutation({
		mutationFn: startBankConnection,
		// the bank authorization happens on the bank website, which sends the browser back to /money/banking/callback
		onSuccess: ({ url }) => {
			window.location.href = url;
		},
	});

	function closeModal() {
		navigate({ to: returnTo, replace: true, resetScroll: false });
	}

	function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (aspspName) startMutation.mutate({ aspspName, aspspCountry: country });
	}

	return (
		<form onSubmit={onSubmit}>
			<Modal className="modal form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
				<div className="dialog-header">
					<h2 id="dialog-title">Connecter une banque</h2>
				</div>
				<div className="dialog-body">
					<div className="form-grid">
						<label className="form-field">
							<span>Pays</span>
							<select
								value={country}
								onChange={(e) => {
									setCountry(e.target.value);
									setAspspName("");
								}}
							>
								{COUNTRIES.map((c) => (
									<option key={c.code} value={c.code}>
										{c.label}
									</option>
								))}
							</select>
						</label>
						<label className="form-field">
							<span>Banque</span>
							<select value={aspspName} onChange={(e) => setAspspName(e.target.value)} required>
								<option value="">{aspsps.isPending ? "Chargement…" : ""}</option>
								{aspsps.data?.map((aspsp) => (
									<option key={aspsp.name} value={aspsp.name}>
										{aspsp.name}
									</option>
								))}
							</select>
						</label>
					</div>
					<p>Vous allez être redirigé vers votre banque pour autoriser l'accès en lecture à vos comptes.</p>
				</div>
				<div className="dialog-footer">
					<MutationError error={aspsps.error ?? startMutation.error} />
					<button type="button" onClick={closeModal}>
						Annuler
					</button>
					<button type="submit" className="main" disabled={!aspspName || startMutation.isPending}>
						Continuer vers la banque
					</button>
				</div>
			</Modal>
		</form>
	);
}
