import { MusicArtistItemSchema, MusicListeningSchema } from "@personal-tracker/shared/music";
import z from "zod";

export const MusicListeningFormSchema = MusicListeningSchema.partial({ id: true }).extend({
	artist: z.array(z.object({ value: MusicArtistItemSchema })).min(1),
	album: z.string().nonempty(),
	contextTags: z.array(z.object({ value: z.string() })).optional(),
});
const MusicListeningFormSchemaTransformation = MusicListeningFormSchema.transform((data) => ({
	...data,
	artist: (data.artist ?? []).map((name) => name.value),
	...(data.contextTags ? { contextTags: data.contextTags?.map((name) => name.value) } : {}),
}));

export type MusicListeningForm = z.infer<typeof MusicListeningFormSchema>;

export const onSubmitListening = (data: MusicListeningForm) => {
	return MusicListeningFormSchemaTransformation.parse(data);
};
