// error of a failed save/delete, shown in the modal so the user can retry
export default function MutationError({ error }: { error: Error | null }) {
	if (!error) {
		return null;
	}
	return <p className="error">Erreur : {error.message}</p>;
}
