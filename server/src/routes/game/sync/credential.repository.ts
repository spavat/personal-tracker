import type { FastifyInstance } from "fastify";

const MONGO_GAME_SYNC_CREDENTIAL_COLLECTION = "game_sync_credential";
const EPIC_CREDENTIAL_ID = "epic";

// Epic OAuth session (the refresh token rotates on every refresh); dates are ISO instants
export interface EpicCredential {
	accountId: string;
	refreshToken: string;
	refreshExpiresAt: string;
	accessToken?: string;
	accessExpiresAt?: string;
}

interface CredentialMongo extends EpicCredential {
	_id: string;
}

export class CredentialRepository {
	constructor(private mongo: FastifyInstance["mongo"]) {}

	private get collection() {
		return this.mongo?.db?.collection<CredentialMongo>(MONGO_GAME_SYNC_CREDENTIAL_COLLECTION);
	}

	async getEpic(): Promise<EpicCredential | null> {
		const credential = await this.collection?.findOne({ _id: EPIC_CREDENTIAL_ID });
		if (!credential) return null;
		const { _id, ...rest } = credential;
		return rest;
	}

	saveEpic(credential: EpicCredential) {
		return this.collection?.updateOne({ _id: EPIC_CREDENTIAL_ID }, { $set: credential }, { upsert: true });
	}
}
