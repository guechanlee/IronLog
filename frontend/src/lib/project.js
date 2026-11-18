// Where this project lives and where it comes from. IronLog is a fork of openGym (Duarte Santos,
// AGPL-3.0-or-later), so the attribution stays and the source link points at the running fork.
//
// Set VITE_SOURCE_URL at build time to this fork's repository, e.g. https://github.com/<you>/ironlog.
// AGPL section 13 asks that the people using a modified version over a network can get its source.
// Until it is set, the link falls back to the upstream project.
export const UPSTREAM_URL = 'https://github.com/DuarteSantos8/openGym'
export const SOURCE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SOURCE_URL) || UPSTREAM_URL
