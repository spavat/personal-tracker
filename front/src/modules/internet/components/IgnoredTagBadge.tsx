import Badge from "../../../components/Badge";

// Program tag not applied to an episode
export default function IgnoredTagBadge({ name }: { name: string }) {
	return (
		<Badge icon="fa-solid fa-ban" name={name} color="white" backgroundColor="red" title="Tag du programme ignoré" />
	);
}
