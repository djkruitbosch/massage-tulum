export { healthResponseSchema } from './health.schema.js';
export type { HealthResponse } from './health.schema.js';

export {
  createPendingStudioSchema,
  signupResponseSchema,
  pendingStudioSchema,
  pendingStudiosListSchema,
  rejectStudioSchema,
} from './pending-studio.schema.js';
export type {
  CreatePendingStudioInput,
  SignupResponse,
  PendingStudio,
  PendingStudiosList,
  RejectStudioInput,
} from './pending-studio.schema.js';

export { phoneSchema, optionalPhoneSchema } from './phone.schema.js';
export type { PhoneE164 } from './phone.schema.js';

export {
  studioProfileSchema,
  updateStudioProfileSchema,
  studioHoursEntrySchema,
  studioHoursSchema,
} from './studio-profile.schema.js';
export type {
  StudioProfile,
  UpdateStudioProfileInput,
  StudioHoursEntry,
  StudioHours,
} from './studio-profile.schema.js';

export {
  therapistSchema,
  createTherapistSchema,
  updateTherapistSchema,
  setTherapistStatusSchema,
} from './therapist.schema.js';
export type {
  Therapist,
  CreateTherapistInput,
  UpdateTherapistInput,
  SetTherapistStatusInput,
} from './therapist.schema.js';
