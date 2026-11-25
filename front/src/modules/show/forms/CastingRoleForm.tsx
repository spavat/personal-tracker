import { useFormContext } from "react-hook-form";

import { CastingForm } from "./CastingRoleForm.utils";
import { RolesField } from "./RolesField";

export default function CastingRoleFormComponent() {
	const { control, register, setValue } = useFormContext<CastingForm>();

	return (
		<>
			<h3>Casting</h3>
			<div>
				<RolesField control={control} register={register} setValue={setValue} name="roles" variant="cast" />
			</div>
		</>
	);
}
