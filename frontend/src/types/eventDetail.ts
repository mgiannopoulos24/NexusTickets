/** Mirrors backend `domain.EventDetail` / API `event_detail`. */

export type ContributorCredit = {
  role: string;
  name: string;
};

export type ArtistCredit = {
  name: string;
  role?: string;
};

export type EventUsefulInfo = {
  duration_minutes: number | null;
  intermission_minutes: number | null;
  seated_only: boolean | null;
  parking_available: boolean | null;
  cancellation_policy: string;
};

export type OrganizerPublicInfo = {
  legal_name: string;
  headquarters: string;
  vat_number: string;
  email: string;
  phone: string;
  tax_office: string;
};

export type EventOccurrence = {
  starts_at: string;
  ends_at?: string;
  label?: string;
};

export type EventDetail = {
  contributors: ContributorCredit[];
  artists: ArtistCredit[];
  useful: EventUsefulInfo | null;
  organizer_display: OrganizerPublicInfo | null;
  occurrences: EventOccurrence[];
};

export function emptyEventDetail(): EventDetail {
  return {
    contributors: [],
    artists: [],
    useful: {
      duration_minutes: null,
      intermission_minutes: null,
      seated_only: null,
      parking_available: null,
      cancellation_policy: '',
    },
    organizer_display: {
      legal_name: '',
      headquarters: '',
      vat_number: '',
      email: '',
      phone: '',
      tax_office: '',
    },
    occurrences: [],
  };
}

export function normalizeEventDetail(raw: unknown): EventDetail {
  const base = emptyEventDetail();
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;

  if (Array.isArray(o.contributors)) {
    base.contributors = o.contributors
      .filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object')
      .map((c) => ({
        role: typeof c.role === 'string' ? c.role : '',
        name: typeof c.name === 'string' ? c.name : '',
      }));
  }

  if (Array.isArray(o.artists)) {
    base.artists = o.artists
      .filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object')
      .map((a) => ({
        name: typeof a.name === 'string' ? a.name : '',
        role: typeof a.role === 'string' ? a.role : undefined,
      }));
  }

  if (o.useful !== null && typeof o.useful === 'object') {
    const u = o.useful as Record<string, unknown>;
    base.useful = {
      duration_minutes: typeof u.duration_minutes === 'number' ? u.duration_minutes : null,
      intermission_minutes:
        typeof u.intermission_minutes === 'number' ? u.intermission_minutes : null,
      seated_only: typeof u.seated_only === 'boolean' ? u.seated_only : null,
      parking_available: typeof u.parking_available === 'boolean' ? u.parking_available : null,
      cancellation_policy: typeof u.cancellation_policy === 'string' ? u.cancellation_policy : '',
    };
  }

  const org = o.organizer_display;
  if (org !== null && typeof org === 'object') {
    const g = org as Record<string, unknown>;
    base.organizer_display = {
      legal_name: typeof g.legal_name === 'string' ? g.legal_name : '',
      headquarters: typeof g.headquarters === 'string' ? g.headquarters : '',
      vat_number: typeof g.vat_number === 'string' ? g.vat_number : '',
      email: typeof g.email === 'string' ? g.email : '',
      phone: typeof g.phone === 'string' ? g.phone : '',
      tax_office: typeof g.tax_office === 'string' ? g.tax_office : '',
    };
  }

  if (Array.isArray(o.occurrences)) {
    base.occurrences = o.occurrences
      .filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object')
      .map((oc) => ({
        starts_at: typeof oc.starts_at === 'string' ? oc.starts_at : '',
        ends_at: typeof oc.ends_at === 'string' ? oc.ends_at : undefined,
        label: typeof oc.label === 'string' ? oc.label : undefined,
      }))
      .filter((oc) => oc.starts_at.length > 0);
  }

  return base;
}
