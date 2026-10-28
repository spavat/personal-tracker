import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { SubmitHandler, useForm } from "react-hook-form";

import "./auth.css";
import { authClient } from "../../auth/auth-client";
import MutationError from "../../components/mutation-error";

type LoginFormInputs = {
	email: string;
	password: string;
};

export default function Login() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<LoginFormInputs>({ defaultValues: { email: "", password: "" } });

	const loginMutation = useMutation({
		mutationFn: async (data: LoginFormInputs) => {
			const { error } = await authClient.signIn.email(data);
			if (error) {
				throw new Error(
					error.status === 401 ? "Email ou mot de passe incorrect" : (error.message ?? error.statusText),
				);
			}
		},
		onSuccess: async () => {
			await queryClient.resetQueries({ queryKey: ["session"] });
			navigate({ to: "/" });
		},
	});

	const onSubmit: SubmitHandler<LoginFormInputs> = (data) => loginMutation.mutate(data);

	return (
		<form className="login-form" onSubmit={handleSubmit(onSubmit)}>
			<h2>Connexion</h2>
			<div className="form-grid">
				<label className="form-field full-width">
					<span>Email</span>
					<input type="email" autoComplete="username" {...register("email", { required: true })} />
					{errors.email && <span className="error">L'email est obligatoire</span>}
				</label>
				<label className="form-field full-width">
					<span>Mot de passe</span>
					<input
						type="password"
						autoComplete="current-password"
						{...register("password", { required: true })}
					/>
					{errors.password && <span className="error">Le mot de passe est obligatoire</span>}
				</label>
			</div>
			<MutationError error={loginMutation.error} />
			<button type="submit" className="main" disabled={loginMutation.isPending}>
				{loginMutation.isPending ? "Connexion…" : "Se connecter"}
			</button>
		</form>
	);
}
