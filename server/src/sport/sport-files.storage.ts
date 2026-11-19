import { Injectable } from "@nestjs/common";

import { ObjectStorage } from "../storage/object-storage.js";

// The GPX file and the route thumbnail of each activity
@Injectable()
export class SportFilesStorage {
	constructor(private readonly storage: ObjectStorage) {}

	uploadGpx(key: string, rawData: string) {
		return this.storage.put(key, rawData, "application/gpx+xml");
	}

	gpxDownloadUrl(key: string, activityName: string) {
		return this.storage.signedDownloadUrl(key, `${activityName}.gpx`);
	}

	uploadThumbnail(key: string, image: Buffer) {
		return this.storage.put(key, image, "image/avif");
	}

	delete(key: string) {
		return this.storage.delete(key);
	}
}
