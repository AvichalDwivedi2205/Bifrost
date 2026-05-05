/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentMessages from "../agentMessages.js";
import type * as missionArtifacts from "../missionArtifacts.js";
import type * as missions from "../missions.js";
import type * as paymentRequests from "../paymentRequests.js";
import type * as registryApplications from "../registryApplications.js";
import type * as verificationReports from "../verificationReports.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentMessages: typeof agentMessages;
  missionArtifacts: typeof missionArtifacts;
  missions: typeof missions;
  paymentRequests: typeof paymentRequests;
  registryApplications: typeof registryApplications;
  verificationReports: typeof verificationReports;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
