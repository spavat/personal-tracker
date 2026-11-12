import Badge from "./Badge";

type TagBadgeProps = { name: string } & React.HTMLAttributes<HTMLSpanElement>;

export default function TagBadge({ name, ...props }: TagBadgeProps) {
	return <Badge icon="fa-solid fa-tag" name={name} color="white" backgroundColor="green" {...props} />;
}
