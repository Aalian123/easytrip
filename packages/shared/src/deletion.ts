/**
 * Administrator deletion.
 *
 * Deleting is the one way history leaves the platform, so it is admin-only and
 * always previewed: the API reports what else goes with the record and what is
 * kept but loses its link to it, before anything is removed.
 */

export const DeletionKind = {
  VEHICLE: 'vehicle',
  RIDER: 'rider',
  FUEL_CARD: 'fuel-card',
  DAMAGE: 'damage',
  ACCIDENT: 'accident',
  USER: 'user',
  DOCUMENT: 'document',
  MEDIA: 'media',
} as const;
export type DeletionKind = (typeof DeletionKind)[keyof typeof DeletionKind];

export const DELETION_KINDS = Object.values(DeletionKind);

export interface DeletionImpact {
  label: string;
  count: number;
}

export interface DeletionPreview {
  kind: DeletionKind;
  id: string;
  /** How the record is named in the confirmation, e.g. "Toyota Corolla (LEA-1234)". */
  label: string;
  /** Typed back by the admin before a deletion that takes other records with it. */
  confirmText: string | null;
  /** Set when the record cannot be deleted in its current state, and why. */
  blockedReason: string | null;
  /** Related records that are deleted along with it. */
  deletes: DeletionImpact[];
  /** Related records that stay, but no longer point at it. */
  keeps: DeletionImpact[];
  notes: string[];
}
