import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import MutationError from "../../../components/MutationError";
import { completeBankConnection } from "../api";

interface Props {
	code?: string;
	state?: string;
	error?: string;
	errorDescription?: string;
}

/** Page the bank sends the browser back to after the authorization */
export default function BankCallback({ code, state, error, errorDescription }: Props) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const started = useRef(false);
	const completeMutation = useMutation({
		mutationFn: completeBankConnection,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["money", "banking"] });
			navigate({ to: "/money/banking/connections", replace: true });
		},
	});

	const { mutate } = completeMutation;
	useEffect(() => {
		// the authorization code is single use: StrictMode must not send it twice
		if (started.current || !code || !state) return;
		started.current = true;
		mutate({ code, state });
	}, [code, state, mutate]);

	return (
		<>
			<h2>Connexion bancaire</h2>
			{error ? (
				<p className="error">Autorisation refusée par la banque : {errorDescription ?? error}</p>
			) : !code || !state ? (
				<p className="error">Réponse de la banque incomplète.</p>
			) : (
				<>
					{completeMutation.isPending && <p>Finalisation de la connexion…</p>}
					<MutationError error={completeMutation.error} />
				</>
			)}
			<p>
				<Link to="/money/banking/connections">Retour aux connexions</Link>
			</p>
		</>
	);
}
