import { useFormContext } from "react-hook-form";

import { ModelForm } from "./ModelRoleForm.utils";
import { RolesField } from "./RolesField";

export default function ModelRoleFormComponent() {
	const { control, register, formState, setValue } = useFormContext<ModelForm>();

	return (
		<>
			<div className="panel">
				<h3>Informations</h3>
				<div className="form-grid">
					<label className="form-field full-width">
						<span>
							Nom<span className="req">*</span>
						</span>
						<input {...register("name", { required: true })} type="text" autoComplete="off" />
					</label>
				</div>
			</div>
			<div className="panel">
				<h3>Casting</h3>
				<RolesField control={control} register={register} setValue={setValue} name="roles" variant="model" />
			</div>
			{Object.keys(formState.errors).length > 0 && (
				<div className="panel">{Object.keys(formState.errors).join(", ")}</div>
			)}
		</>
	);
}
