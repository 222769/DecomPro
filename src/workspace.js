import { fields } from './data';

export const defaultFields = [
  ['date', 'Disposal date', 'date'],
  ['description', 'Equipment description', 'text'],
  ['manufacturer', 'Manufacturer', 'text'],
  ['source', 'Taken from', 'text'],
  ['reason', 'Reason for disposal', 'text'],
  ['trolley', 'Caged trolley', 'text'],
];
export const defaultSettings = { speechRate: .92, speechVolume: 1, skipWindow: 700, reuseModel: false, batchModel: '', voiceURI: '' };
const text = (value, allowEmpty = false) => typeof value === 'string' && (allowEmpty || value.trim().length > 0);
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateWorkspace(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.items) ||
      !Array.isArray(value.profiles) || !value.profiles.length ||
      !value.defaults || !value.draft || !Number.isInteger(value.step) || value.step < 0 || value.step > fields.length ||
      typeof value.voice !== 'boolean') throw Error('This file does not contain a valid DecomPro workspace.');
  const codes = new Set();
  const profiles = value.profiles.map(profile => {
    if (!profile || !text(profile.name) || !text(profile.code) || codes.has(profile.code)) throw Error('The backup has invalid technician profiles.');
    codes.add(profile.code);
    return { name: profile.name, code: profile.code };
  });
  if (!codes.has(value.active)) throw Error('The backup has no selected technician.');
  const defaults = {};
  for (const [key] of defaultFields) {
    if (!text(value.defaults[key], true)) throw Error('The backup has invalid batch defaults.');
    defaults[key] = value.defaults[key];
  }
  if (!validDate(defaults.date)) throw Error('The backup has an invalid disposal date.');
  const ids = new Set();
  const items = value.items.map(item => {
    if (!item || !text(item.id) || ids.has(item.id) || !text(item.technician) || !validDate(item.date)) throw Error('The backup has invalid or repeated item IDs or dates.');
    ids.add(item.id);
    const clean = { id: item.id, technician: item.technician };
    for (const [key] of [...defaultFields, ...fields]) {
      if (!text(item[key])) throw Error('The backup has an incomplete equipment record.');
      clean[key] = item[key];
    }
    return clean;
  });
  const draft = {};
  for (const [key] of fields) {
    if (value.draft[key] !== undefined) {
      if (!text(value.draft[key])) throw Error('The backup has invalid captured values.');
      draft[key] = value.draft[key];
    }
  }
  if (fields.slice(0, value.step).some(([key]) => !draft[key])) throw Error('The backup has inconsistent scanning progress.');
  const settings = { ...defaultSettings };
  if (value.settings !== undefined) {
    const input = value.settings;
    if (!input || typeof input !== 'object' || !Number.isFinite(input.speechRate) || input.speechRate < .6 || input.speechRate > 1.5 ||
        !Number.isFinite(input.speechVolume) || input.speechVolume < 0 || input.speechVolume > 1 ||
        !Number.isInteger(input.skipWindow) || input.skipWindow < 300 || input.skipWindow > 1500 ||
        (input.voiceURI !== undefined && !text(input.voiceURI, true)) ||
        typeof input.reuseModel !== 'boolean' || !text(input.batchModel, true) || (input.reuseModel && !input.batchModel.trim())) {
      throw Error('The workspace has invalid scanner or voice settings.');
    }
    for (const key of Object.keys(defaultSettings)) if (input[key] !== undefined) settings[key] = input[key];
  }
  return { profiles, active: value.active, defaults, items, draft, step: value.step, voice: value.voice, settings };
}
export function parseBackup(contents) {
  const data = JSON.parse(contents);
  if (data?.app !== 'DecomPro' || data.version !== 1) throw Error('Choose a DecomPro JSON backup, version 1.');
  return validateWorkspace(data.state);
}
export function filteredItems(items, query) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(item => {
    const haystack = [...defaultFields, ...fields, ['technician']].map(([key]) => item[key]).join(' ').toLowerCase();
    return terms.every(term => haystack.includes(term));
  }).slice().reverse();
}
