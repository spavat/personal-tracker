import { Inject, Injectable } from "@nestjs/common";
import { Db } from "mongodb";

import { MONGO_DB } from "../../database/database.tokens.js";

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

@Injectable()
export class CredentialRepository {
	constructor(@Inject(MONGO_DB) private readonly db: Db) {}

	private get collection() {
		return this.db.collection<CredentialMongo>("game_sync_credential");
	}

	async getEpic(): Promise<EpicCredential | null> {
		const credential = await this.collection.findOne({ _id: EPIC_CREDENTIAL_ID });
		if (!credential) return null;
		const { _id, ...rest } = credential;
		return rest;
	}

	saveEpic(credential: EpicCredential) {
		return this.collection.updateOne({ _id: EPIC_CREDENTIAL_ID }, { $set: credential }, { upsert: true });
	}
}
