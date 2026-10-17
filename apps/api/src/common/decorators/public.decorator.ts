import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'easytrip:isPublic';

/** Marks a route as reachable without a signed-in user. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
