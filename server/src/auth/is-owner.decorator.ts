import { createParamDecorator } from "@nestjs/common";

import { viewerIsOwner } from "../common/request-context.js";

export const IsOwner = createParamDecorator(() => viewerIsOwner());
